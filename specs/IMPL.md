# Saturno — Implementation Details

This document sits one level below TR.md: TR.md decides *what technology and why* (client-only SPA, IndexedDB, Web Worker, etc.); this document decides *how the pieces fit together* — module boundaries, function signatures, the search algorithm, and data flow. It implements the behavior introduced by FR-32–34 (time-boxed multi-solution generation), FR-35–37 (Teacher Absence & Repair, §5.6), and FR-19/FR-22 (Notes and human-readable export, §9) in FR.md.

Status tags follow the same convention as the other docs: `[NEW]` (introduced here) with a `Why` line; `[CHALLENGED]` marks a point from the original proposal that was changed after review, with the original kept for record.

---

## 1. Original Proposal (for record)

As proposed by the user, before review:

- A **Solver**, a **Verifier**, and a **Classifier**, as three Rust functions compiled to WASM and called from JavaScript.
- The Verifier checks a schedule for conflicts.
- The Classifier scores schedule quality for teachers and students (e.g. how scattered a schedule is).
- The Solver produces a single solution.
- Because multiple solutions can exist, the Solver runs for a user-set time budget (e.g. 10 minutes); all solutions found are ranked by the Classifier and presented to the user.
- Frontend: Vue + Pinia.

Everything below either keeps a piece of this as-is or explains what changed and why.

---

## 2. Challenges & Resolutions

| # | Original proposal | Challenge | Resolution |
|---|---|---|---|
| 1 | "Classifier" | Scoring continuous schedule quality for ranking isn't classification into categories — the name will mislead whoever implements it. | Renamed **Scorer** throughout. Pure naming change. |
| 2 | Solver run repeatedly for 10 min | A deterministic search re-run for 10 minutes returns the same answer every time — "multiple solutions" requires the search to actually be randomized/diversified. | Solver is split into a **Constructor** (initial feasible search) + **Refiner** (randomized local search / perturbation), so repeated runs genuinely diverge. See §5. |
| 3 | Single Solver, run for a time budget | A pure time-boxed metaheuristic can't *prove* infeasibility (FR-16 promises a specific "this can't be satisfied because X" report) — it just runs out of time still holding violations. | Hybrid: a fast constructive/backtracking phase runs first and gives a genuine "no feasible assignment for X" signal; only after that does time-boxed diversification run. See §5.1. |
| 4 | (implicit) parallel search via multi-threaded WASM | True WASM threads need `SharedArrayBuffer`, which requires the **host** to send `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` headers — a hosting-environment dependency that sits awkwardly against TR-2's "just a static client-side SPA." | Parallelism via a **pool of independent Web Workers**, each with its own WASM instance and RNG seed, coordinated over plain `postMessage`. No shared memory, no header dependency. See §5.2. |
| 5 | (implicit) run silently for up to 10 minutes | A black-box wait with no feedback and no way to stop early is a bad interaction, especially once a good candidate already showed up at minute 2. | Workers stream progress (`candidatesFound`, `bestScoreSoFar`) periodically; the run is cancellable at any point, keeping whatever was found so far. See §5.3. |
| 6 | Rust + WASM for all three functions | At the target scale (TR-10), plain TypeScript might be fast enough for *one* generation. The real justification is maximizing candidates explored per minute under a fixed time budget, where JS's GC pauses and less predictable perf actually cost something. | Kept Rust + WASM, but the reasoning is now explicit (§6) rather than assumed — if profiling ever shows the throughput gain isn't worth the toolchain cost, TS is a legitimate fallback for the Constructor/Refiner. |
| 7 | Vue + Pinia | Not challenged as a framework choice. But nothing specified how Pinia state maps onto TR-5's IndexedDB persistence, or whether the JS side is typed. | Added TypeScript (pairs with `wasm-bindgen`'s generated `.d.ts`) and a concrete persistence layer (§7). |
| 8 | "Solver basically produces a single solution" | If the Solver only produces one candidate per run, running the whole app logic N times to get N candidates duplicates work and makes streaming/cancellation harder to reason about. | The exported `generate` function *is* the loop — it internally runs Constructor once, then Refiner repeatedly, and is itself the unit that gets time-boxed. See §4.3. |

---

## 3. Module Architecture

```
┌─────────────────────────────── Main thread ───────────────────────────────┐
│  Vue 3 (TypeScript) components                                            │
│      │                                                                    │
│      ▼                                                                    │
│  Pinia stores  ── persistence plugin ──►  IndexedDB (via `idb`)           │
│      │                                              (TR-5)                │
│      │ postMessage: {entities, constraints, timeBudgetMs}                 │
│      ▼                                                                    │
│  Generation Coordinator (plain TS module, runs on main thread)            │
│      │ spawns N Web Workers, N = navigator.hardwareConcurrency (capped)   │
└──────┼──────────────────────────────────────────────────────────────────┘
       │
       ▼  (one per Worker, independent, no shared memory)
┌───────────────── Web Worker ─────────────────┐   ×N, running in parallel
│  WASM module instance (Rust, its own RNG seed)│
│    - generate(...)  → streams progress msgs   │
│    - verify(...)                              │
│    - score(...)                               │
└────────────────────────────────────────────────┘
       │ postMessage: progress / candidate found / done
       ▼
  Coordinator merges, deduplicates (§5.4), and ranks all candidates
  by Scorer output before handing the ranked list back to Pinia.
```

The **Verifier** is also called standalone, directly from the main thread (no Worker needed — it's cheap), whenever a manual edit happens (FR-18), against whatever single WASM instance is loaded on the main thread for that purpose. The **Repair** function (§5.6, FR-35–37) runs the same way — main thread, no Worker pool — since it searches only the handful of slots a Teacher Absence vacates, not the full problem.

---

## 4. The Four Exported Rust/WASM Functions

The public WASM surface is the three functions originally proposed — `verify`, `score`, `generate` — plus `repair`, added after the review session that introduced FR-35–37 (Teacher Absence). Each is pure (no hidden state beyond what's passed in, except `generate`'s internal search state between progress-chunk calls, see §5.3).

### 4.1 `verify(input: ScheduleInput, schedule: Schedule) -> Vec<Violation>`

Checks a candidate `Schedule` against every hard constraint from FR-14 and FR-29 (Joint Sessions). Returns an empty list if valid, otherwise a structured list of violations (constraint type, the specific Teacher/Class/slot involved) — this list is what backs both FR-16 (infeasibility reporting) and FR-18 (flagging a manual edit's conflicts).

Used three ways:
- **Internally**, by the Constructor/Refiner (§5) to prune invalid moves during search — not re-implemented, the same function is called.
- **Standalone**, from the main thread, whenever the user manually edits a slot (FR-18) — its result is not persisted; it's recomputed the same way every time the affected view renders, so a Conflict Flag can never go stale relative to current entity data. Cheap enough (§3) that per-render recomputation is not a performance concern at TR-10's target scale.
- **Standalone**, from the main thread, by `repair` (§5.6) when filtering candidate substitute Teachers.

### 4.2 `score(input: ScheduleInput, schedule: Schedule) -> ScoreBreakdown`

Computes the FR-15 soft objectives for an already-valid `Schedule`. Returns a **breakdown**, not just one number — e.g. `{ teacherGapScore, subjectDistributionScore, total }` — so the UI can explain *why* one candidate outranks another ("menos janelas para os professores" vs. "distribuição mais uniforme"), not just show a bare rank.

### 4.3 `generate(input: ScheduleInput, timeBudgetMs: u32) -> impl Iterator<Item = Candidate>` (conceptually — see §5.3 for the real chunked-call shape)

Runs the Constructor once, then the Refiner repeatedly until `timeBudgetMs` elapses, calling `verify` internally to reject invalid moves and `score` internally to evaluate/accept candidates. This single function *is* the "run for N minutes" behavior — there's no separate outer loop re-invoking a one-shot solver.

### 4.4 `repair(input: ScheduleInput, schedule: Schedule, absence: Absence) -> RepairResult`

Given an already-valid `Schedule` and an `Absence` (FR-35: a Teacher plus the specific day/period(s) they're out), finds a replacement Teacher for each vacated slot — restricted to Teachers already configured for that (Class, Subject) via FR-9 — without touching any other assignment. Returns a `RepairResult { filled: Vec<(SlotRef, TeacherId)>, unfillable: Vec<SlotRef> }`: slots it could fix, and slots it couldn't (FR-37), never a single all-or-nothing outcome. See §5.6 for the search itself.

---

## 5. Multi-Solution Time-Boxed Search

### 5.1 Two phases

- **Constructor**: a greedy/backtracking constructive search with constraint propagation, respecting every FR-14/FR-29 hard constraint as it builds. Runs once per Worker at the start. If the Constructor cannot find *any* feasible assignment within a bounded backtracking effort, that's the signal FR-16's infeasibility report is built from — naming the specific (Class, Subject) or Teacher assignment it got stuck on. **Scope, confirmed with user**: this is the single deepest dead-end reached, not an exhaustive scan of every unsatisfiable constraint — a fuller multi-conflict scan was considered and explicitly deferred past v1 as more solver work than its benefit justifies right now.
- **Refiner**: starting from a Constructor's feasible solution, repeatedly perturbs it (e.g. swap two assignments, reassign a slot) and re-verifies (`verify`) — only feasibility-preserving moves are kept — accepting or rejecting moves based on `score` (simulated-annealing-style: always accept an improvement, sometimes accept a worse move early on to escape local optima, cooling off over the remaining time budget). Each locally-optimal or improved state encountered is emitted as a `Candidate`.

### 5.2 Parallelism: Worker pool, not WASM threads `[CHALLENGED]`

Each Worker runs its own independent Constructor + Refiner with a distinct RNG seed — no shared memory, no `SharedArrayBuffer`, no cross-origin-isolation header requirement on the host. Parallelism is bounded by `navigator.hardwareConcurrency` (capped at a sane maximum, e.g. 6–8, to leave the main thread responsive). This trades a small amount of theoretical throughput (vs. true shared-memory threading) for zero deployment-environment dependency, consistent with TR-2/TR-4's "just static files, works anywhere" stance.
> **Confirmed by the v5 hosting decision (TR-17):** GitHub Pages cannot set custom response headers at all, so the `COOP`/`COEP` headers `SharedArrayBuffer` would require are not just undesirable to depend on — they're unavailable on the actual chosen host. This decision was made for portability reasons before the host was picked; picking GitHub Pages removes any future temptation to revisit it.

### 5.3 Progress streaming & cancellation `[NEW]`

`generate` is not a single multi-minute blocking call. Internally, the Refiner loop runs in small fixed slices (e.g. ~100ms of search), yielding control back to the Worker's message loop after each slice to:
- `postMessage` a progress update (`candidatesFoundSoFar`, `bestScoreSoFar`, `elapsedMs`) to the coordinator, which relays it into a Pinia store the UI reads reactively.
- Check a cancellation flag (a plain boolean the coordinator can set via `postMessage`, checked at the top of the next slice) — no `SharedArrayBuffer` needed, since cancellation only needs to be checked at slice boundaries, not instantaneously.

This is what makes "the user can cancel early and keep whatever was found" (FR-34) and "live progress" (FR-34) possible without WASM threading.

### 5.4 Deduplication `[NEW]`

Before ranking, the coordinator drops near-duplicate candidates (e.g. Hamming distance between two candidates' assignment grids below a threshold), so the ranked list shown to the user (FR-32) is meaningfully diverse rather than trivial permutations of the same schedule.

### 5.5 Quick mode vs. deep mode

The Constructor alone (before any Refiner iterations) already returns a valid schedule in roughly the time TR-10 targets (a few seconds) — this is effectively "quick mode," and can be surfaced as the default when the user hasn't asked for a longer search. "Deep mode" is the user setting an explicit time budget (FR-32) to let the Refiner run across the Worker pool and return a ranked set instead of just the first feasible result.

### 5.6 Repair mode (Teacher Absence) `[NEW]`

A third mode, added for FR-35–37, distinct from both quick and deep mode: it does not build a schedule from scratch, and it never runs the Refiner or Scorer — a repair is a minimal fix, not a re-optimization, per the "leave everything else untouched" requirement in FR-36.

- **Trigger**: FR-35 marks a Teacher absent for specific period(s), which vacates the corresponding slot(s) in the current Schedule Version.
- **Candidate search, per vacated slot**: the Constructor's constraint-checking logic is reused, but restricted to Teachers already linked to that (Class, Subject) via FR-9 (excluding the absent Teacher), filtered to those available at that slot (FR-3) and not already occupied elsewhere in the *unmodified* rest of the schedule — then checked against every Hard Constraint (FR-14/FR-29) as it would apply with the rest of the schedule held fixed, including the Consecutive Period Ceiling relative to what's already adjacent.
- **Joint fitting across multiple vacated slots**: when an absence vacates more than one slot in a day, candidate substitute Teachers can overlap between slots (the same Teacher might be the only fit for two different vacated periods, but can only fill one). This is a small bipartite-matching problem — at most a handful of vacated slots per absence — solved by backtracking search over the (typically tiny) candidate sets, not the Constructor's full backtracking machinery.
- **Partial success is the normal case, not an error path**: whatever subset of vacated slots has a feasible assignment is filled; any slot with no feasible candidate is reported per FR-37 (`RepairResult.unfillable`, §4.4) rather than blocking the slots that *did* find a fit.
- **Runs on the main thread** (TR-16), synchronously — no Worker pool, no progress streaming, no cancellation UI, since the search space here is orders of magnitude smaller than a full `generate` run.
- **Modeling boundary**: repair only ever considers Teachers already configured for the affected (Class, Subject) — see PRD.md §7's assumption. Saturno does not model a general "who else can teach Subject X" qualification pool, so a slot where the absent Teacher was the *only* one configured for that (Class, Subject) is always reported unfillable, never offered to an unrelated but plausibly-qualified Teacher.

---

## 6. Why Rust + WASM (made explicit) `[CHALLENGED]`

The justification is **throughput of candidates explored per minute under a fixed time budget**, not raw single-run speed — at TR-10's target scale, a single generation is probably fast enough in plain TypeScript too. Rust's lack of GC pauses and predictable performance matter specifically because the value of "deep mode" comes from exploring as much of the search space as possible in, say, 10 minutes across several parallel Workers. If profiling later shows this gain doesn't justify the added toolchain (Rust toolchain in CI, `wasm-pack`/`wasm-bindgen` build step, a language boundary the rest of a Vue/TS team may not otherwise touch), the Constructor/Refiner could fall back to TypeScript without changing anything above the WASM boundary (§4's function signatures stay the same either way).

Data crossing the JS↔Rust boundary is (de)serialized via `serde` + `serde-wasm-bindgen` (plain JSON-shaped objects on the JS side) rather than a hand-rolled binary protocol — at this data scale (tens of teachers, low hundreds of assignments), serialization cost is negligible next to the search time itself, and JSON is far easier to debug across the boundary. `wasm-bindgen` also generates TypeScript type declarations for the exported functions, keeping the JS side's types in sync with the Rust structs automatically.

---

## 7. Frontend Architecture

- **Vue 3 + TypeScript** (TypeScript added `[CHALLENGED]` — not in the original proposal, but pairs naturally with `wasm-bindgen`'s generated `.d.ts` and catches boundary mismatches at compile time).
- **Pinia** stores, roughly:
  - an **entities store** (Teachers, Segments, Grades, Classes, Subjects, Joint Sessions, Tracks, constraints, Teacher Absences) — the source of truth persisted to IndexedDB.
  - a **generation-run store** — ephemeral state for an in-progress `generate` run (progress, streamed candidates, cancel button state); not persisted.
  - a **schedule-versions store** (FR-24) — the saved, named schedules a user has committed to, including whichever ranked candidate (FR-33) they chose to keep, and the Notes (FR-19) attached to that version (whole-schedule and per-slot). Notes live here rather than in the entities store because they're scoped to one Schedule Version, not shared school-wide configuration. Conflict Flags (FR-18) are **not** stored in this state — see §4.1.
- **Persistence**: a thin wrapper around IndexedDB (the `idb` package, not the raw callback-based API) plus a Pinia plugin that (a) hydrates the entities/schedule-versions stores from IndexedDB on load and (b) writes through on every mutation. This is the concrete mechanism behind TR-5/TR-7 — TR.md specified *that* data persists locally; this is *how* Pinia's in-memory state stays in sync with it.
- **Schema versioning & migration** (TR-8): the exported JSON carries a top-level `schemaVersion: number`, matching the current shape of the entities/schedule-versions stores (kept as one version number, not tracked separately per store). A `migrations/` module holds one pure function per version step (`migrateV1ToV2(data) -> data`, etc.); on import, the chain from the file's version up to the app's current version is applied in order before the result is loaded into the stores. If the file's version is newer than the app supports, import is rejected outright with a pt-BR error message — the app never guesses at an unknown future shape. Each migration function is unit-testable in isolation, same rationale as TR-11.

---

## 8. Toolchain

- `wasm-pack` (or `wasm-bindgen` directly) to build the Rust crate to a WASM package consumable by the Vue app.
- Vite as the bundler (Vue 3's standard default), configured to load the WASM package and spin up the Worker pool. Vite's `base` config is set to the GitHub Pages project-page subpath (`/saturno/`, per TR-17) so every emitted asset, Worker, and WASM URL resolves correctly when served from `https://<user>.github.io/saturno/` rather than domain root.
- CI needs a Rust toolchain in addition to Node — a real, ongoing cost worth naming (challenge #6) rather than treating as free.
- **`exceljs`** for `.xlsx` generation (§10) — chosen over SheetJS's community build because it supports cell fills, merges, and column widths in the browser without a paid tier; the real sample sheets rely on exactly that styling to be readable.
- **Deployment (v5, TR-17/TR-18)**: a GitHub Actions workflow runs on pushes to `main` — installs Node and Rust, runs `wasm-pack build` for the solver crate, runs the Vite production build (with the `base` path above), then publishes the resulting static output to GitHub Pages via the `actions/deploy-pages` action (or an equivalent `gh-pages`-branch publish step). No other hosting-side configuration is needed, consistent with TR-2/TR-4's "just static files" stance.

---

## 9. Human-Readable Export (FR-22, TR-13) `[NEW]`

Two independent output paths, both confirmed in scope for v1, sharing the same view-model (per-Class and per-Teacher grids, each cell showing Subject + Teacher per FR-20/21, plus Notes per FR-19) but rendered differently:

- **Printable**: a `@media print` stylesheet applied to the same grid components used for the on-screen FR-20/21 views, triggered by `window.print()`. No new dependency. Reformats the continuous 5-day on-screen grid into the paper-oriented **two-days-per-row** layout seen in every real sample sheet (so it fits sensibly on printed pages), with Break periods rendered as thin dividing rows exactly as the real sheets do.
- **`.xlsx`**: generated client-side with `exceljs` (§8), building the same two-days-per-row layout as a real workbook — cell fills for headers/breaks, merged cells for multi-column day headers, column widths tuned for the day/period grid — so the output is visually comparable to the existing `sheets/` files, not just a plain data dump (that's what the native `.json` export, TR-12, is for).
- **Notes placement**: a numbered footnote list beneath the grid (matching the real sheets' "Observação 1/2" convention, FR-19), with slot-level notes marked by a small reference marker on their cell linking to the corresponding footnote. Identical in both the printable and `.xlsx` outputs.
- Both paths read from the same in-memory Schedule Version state already hydrated from IndexedDB (§7) — there's no separate export-time data fetch or transform beyond laying it out into the two-days-per-row shape.

---

## 10. Assumptions / Open Questions

- **Refiner acceptance strategy** is assumed to be simulated-annealing-style (accept worse moves early, cool off over the time budget). Tabu search or a genetic algorithm (population of candidates crossed over rather than single-solution perturbation) are viable alternatives with similar parallelization properties — worth a spike before committing if someone on the team has a strong prior.
- **Worker pool size cap** (proposed 6–8) is a guess to keep the main thread responsive on typical hardware; should be tuned once there's a real build to profile.
- **Deduplication threshold** (§5.4) needs an actual number chosen empirically once real candidate schedules exist to compare.
- Whether **Scorer weights** (teacher-gap vs. even-distribution, etc.) should be fixed constants or user-tunable is left open — FR-15 doesn't specify, and this document assumes fixed sensible defaults for MVP.
- **Repair mode's substitute pool** (§5.6) is restricted to Teachers already configured for the affected (Class, Subject) — see PRD.md §7. If a broader "who else could plausibly teach this" pool turns out to be needed, §5.6's candidate-filtering step and FR-9's data model both need revisiting together.
