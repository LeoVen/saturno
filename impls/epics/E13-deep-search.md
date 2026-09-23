# E13 — Deep Search

**Status**: in-progress

## Goal

Beyond the single schedule Quick Generation (E06) produces, let the user run
a time-boxed search that explores many valid candidates in parallel, ranks
them by schedule quality, and lets them watch progress and cancel early.

## Spec references

- **FR-15** — soft objectives (gap minimization, even distribution), never traded against a hard constraint.
- **FR-32** — configurable time budget; ranked list of valid candidates.
- **FR-33** — select one candidate to adopt as a Schedule Version (E07); others discarded unless explicitly kept.
- **FR-34** — live progress (candidates found, best score so far); cancel anytime, keeping what's found.
- **TR-3** — full Worker pool (extends E06's single-Worker quick mode).
- **TR-9** — soft objectives as weighted penalties, optimized without relaxing hard constraints.
- **IMPL.md §4.2** (`score`), **§5.2** (Worker pool), **§5.3** (progress/cancellation), **§5.4** (deduplication), **§6** (throughput rationale).

## Human verification

1. Start a Deep Search with an explicit time budget (e.g. 2 minutes);
   confirm live progress (candidates found, best score) updates while it
   runs.
2. Cancel the run partway through; confirm whatever candidates were found
   so far are still presented, not discarded.
3. Let a run complete; confirm a ranked list of distinct (not
   near-duplicate) candidates is shown, each still satisfying every hard
   constraint from E06/E10.
4. Select one candidate and confirm it's adopted as the active Schedule
   Version (E07); confirm unselected candidates are not persisted unless
   explicitly kept.

## Tasks

| ID | Task | Status |
|---|---|---|
| E13-T1 | Implement `score(input, schedule) -> ScoreBreakdown` in Rust (FR-15, IMPL.md §4.2) | done |
| E13-T2 | Implement the Refiner: perturb + re-verify + accept/reject by score, simulated-annealing-style (IMPL.md §5.1) | done |
| E13-T3 | Worker pool: spawn N Workers (capped, per `navigator.hardwareConcurrency`), each with an independent RNG seed (IMPL.md §5.2) | done |
| E13-T4 | Progress streaming (`candidatesFoundSoFar`, `bestScoreSoFar`, `elapsedMs`) and cancellation flag, checked at slice boundaries (IMPL.md §5.3) | done |
| E13-T5 | Deduplication of near-identical candidates before ranking (IMPL.md §5.4) | done |
| E13-T6 | Coordinator: merge/rank candidates across Workers, hand the ranked list to the UI | new |
| E13-T7 | UI: time-budget input, live progress display, cancel button, ranked candidate list, "adopt as version" action wired to E07 (FR-32–34) | new |
| E13-T8 | Unit tests for `score` and the Refiner's hard-constraint preservation (TR-11) | new |

## Decisions

- See [D-50](../DECISIONS.md) — `score`'s two FR-15 metrics (teacher-gap
  minutes, per-(Class,Subject) daily-count variance) and their weights
  into `total`, all lower-is-better.
- See [D-51](../DECISIONS.md) — the Refiner's move set (intra-Class
  Move/Swap only, Joint Sessions untouched), Candidate-emission rule
  (new-best-only), and cooling schedule (iteration-count-driven for now,
  score-scaled initial temperature).
- See [D-52](../DECISIONS.md) — the pool's size cap (6), per-Worker
  seeding (`crypto.getRandomValues`), lifecycle (spawned/torn down per
  run), and why merging/ranking stays out of `deepSearchPool.ts` (its
  `generateDeep`/one-shot-per-Worker-call parts are superseded by D-53).
- See [D-53](../DECISIONS.md) — `generateDeep` (T3) replaced by a
  resumable `RefineSession`/`DeepSearchSession` driven slice-by-slice;
  Rust stays deliberately clock-free (`elapsed_ms`/`iterations` are
  caller-supplied) so the Refiner stays deterministic/testable; a real
  `SliceResult` serde-casing bug caught and fixed (regression test
  added).
- See [D-54](../DECISIONS.md) — dedup's distance metric (fractional
  Hamming distance over the assignment grid) and default threshold (5%).

## Notes

- **T1 implemented (2026-09-23)**: `solver/src/score.rs`, exported as
  `score(input, schedule)` alongside `verify`/`generateQuick` in `lib.rs`
  (`#[wasm_bindgen]`), wired through `solver.worker.ts`'s message
  protocol and a new `scoreSchedule()` in `generationCoordinator.ts`,
  mirroring `verifySchedule`'s existing shape exactly (same single
  Worker — the pool itself is T3). Reuses `verify.rs`'s private
  `resolve`/`Resolved` (now `pub(crate)`) rather than re-deriving
  real-clock-time resolution a second time. 8 new Rust unit tests
  (`cargo test`, `cargo fmt --check`, `cargo clippy -D warnings` all
  clean) cover: no gap on a single- or back-to-back-period day, an exact
  idle-minutes count for one gap, gaps resolved correctly across two
  Segments with different grids in the same day (D-01-style), zero
  distribution penalty for a perfectly even spread, a concentrated
  spread scoring strictly worse than an even one, `total` matching the
  weighted sum, and a not-yet-placed Assignment contributing nothing
  (must not panic mid-Refiner-search on a partial candidate). TS side:
  full `npm run test`/`lint`/`vue-tsc -b` build all green; no TS-level
  test added for the coordinator/worker plumbing itself (thin pass-
  through, same as `verifySchedule`'s own precedent — no existing test
  file for that either).
- **T2 implemented (2026-09-23)**: `solver/src/refiner.rs`'s `refine`,
  perturbing only `schedule.placements` via intra-Class Move/Swap moves,
  rejecting infeasible proposals via `verify`, accepting/rejecting
  feasible ones by a simulated-annealing rule over `score`'s `total`, and
  emitting a `Candidate` on every new-best (see [D-51](../DECISIONS.md)
  for the exact move set, emission rule, and cooling schedule — all
  explicitly flagged as tunable, not empirically validated against a real
  school yet). Added `rand`/`rand_chacha` (both `default-features =
  false` — always explicitly seeded, no OS-entropy/`getrandom`
  dependency) so both this and E13-T3's per-Worker seeding have a real
  PRNG. Not yet wired into `lib.rs`'s wasm-exported surface or called
  from anywhere outside its own tests (`#[allow(dead_code)]` on the
  module, with a comment pointing at T3/T4/T6) — IMPL.md §4.3 makes clear
  `generate` is the single function that assembles Constructor + Refiner
  together, and that assembly (plus the real time-boxing) is explicitly
  later tasks' job, not T2's.
  8 new Rust unit tests (`cargo test`/`fmt --check`/`clippy -D warnings`
  all clean) cover: every emitted Candidate is independently feasible and
  strictly improves on the previous one; a concentrated-but-feasible
  fixture reaches the true optimum (`total == 0.0`) within a fixed
  iteration budget; determinism (same seed ⇒ identical candidate
  sequence); a Class with no placements yields no move without panicking;
  an already-fully-packed, already-optimal Class only ever proposes Swaps
  (never Moves) and never emits (nothing to improve); Joint Session
  placements are provably untouched across every emitted candidate.
  `wasm-pack build` and the full TS `test`/`lint`/`build` all verified
  green after the new dependency.
- **T3 implemented (2026-09-23)**: `solver/src/lib.rs`'s new `generateDeep`
  wasm export (Constructor once + Refiner for a fixed iteration count
  from a seed — see [D-52](../DECISIONS.md)), wired into
  `solver.worker.ts`'s existing message protocol (a new `generateDeep`
  request/response pair, same shape as `verify`/`score`), and a new pool
  coordinator, `app/src/solver/deepSearchPool.ts`
  (`runDeepSearchPool(input, iterations)`), which spawns
  `poolSize()`-many independent `solver.worker.ts` Worker instances (each
  gets its own WASM module instance for free — Workers share no memory),
  sends each a `generateDeep` request with its own `crypto
  .getRandomValues`-sourced seed, awaits all of them, and terminates the
  whole pool before resolving. Returns `candidatesByWorker: Candidate[][]`
  unmerged/unranked (T5/T6's job) — or the first Worker's
  `InfeasibilityReport` if the (seed-independent) Constructor phase
  itself failed.
  No Vitest-level test added — Worker/WASM-instantiation behavior can't
  be meaningfully exercised in jsdom, consistent with T1's precedent for
  the single-Worker coordinator. Instead verified end-to-end (agent-driven,
  headless Chromium via Playwright): dynamically imported
  `deepSearchPool.ts` straight from the Vite dev server inside the page
  and called `runDeepSearchPool` directly. A feasible, slightly slack
  fixture spawned exactly `poolSize()` (6, this environment's
  `navigator.hardwareConcurrency`) Workers, each independently found a
  different number of improving candidates (5–8, confirming genuinely
  distinct per-Worker random walks) yet all converged on the same true
  optimum (`total === 0`); a deliberately infeasible fixture (a Teacher
  unavailable every weekday) returned the correct pt-BR
  `InfeasibilityReport` message. No console errors in either run.
  **Superseded by T4** — `generateDeep`/`runDeepSearchPool` (this
  paragraph's one-shot shapes) no longer exist; see D-53. The pool
  size/seeding/lifecycle/merge-scope decisions from this task stand
  unchanged in `deepSearchPool.ts`'s new streaming shape.
- **T4 implemented (2026-09-23)**: replaced E13-T2/T3's one-shot
  `refine`/`generateDeep` with a resumable session
  (`RefineSession`/`DeepSearchSession`) driven slice-by-slice — see
  [D-53](../DECISIONS.md) for the full design and a genuinely serious bug
  caught while verifying it (a `SliceResult` serde-casing mistake that
  silently hung the whole pool with no error, same bug class as
  `Violation`'s already-documented E09 regression). `solver.worker.ts`
  gained `startDeepSearch`/`cancelDeepSearch`, driving an autonomous
  slice loop that adaptively sizes each slice toward ~100ms and yields to
  the event loop between slices so a cancellation can land.
  `deepSearchPool.ts`'s `runDeepSearchPool` became
  `startDeepSearchPool(input, timeBudgetMs, onProgress) ->
  {cancel, result}`, aggregating every Worker's streamed progress into
  one FR-34-shaped view.
  2 new Rust unit tests (`RefineSession::run_slice`'s no-op-past-budget
  behavior; the `SliceResult` camelCase regression test) plus the
  existing T2 tests rewritten against the new session API rather than
  duplicated (same intent: feasibility, strict improvement, determinism,
  no-placements/already-optimal edge cases, Joint Sessions untouched) —
  `cargo test`/`fmt --check`/`clippy -D warnings` all clean, 35 Rust
  tests total. TS `test`/`lint`/`build` all green.
  Verified end-to-end (agent-driven, headless Chromium via Playwright,
  same convention as T1/T3): a normal run to a 1500ms budget streamed 108
  progress events across 6 Workers, converged every Worker to the true
  optimum, and finished in ~1660ms wall time (close to the budget, the
  small overrun being real slice/postMessage/scheduling overhead);
  cancelling 200ms into a 10-second budget resolved in ~274ms, not the
  full 10s; the infeasible fixture returned the correct pt-BR reason. No
  console errors in any run. The hung-pool bug above was only caught by
  this verification step — the Rust unit tests alone didn't exercise the
  actual wasm→JS serialization boundary.
- **T5 implemented (2026-09-23)**: `app/src/solver/candidateDedup.ts`
  (`scheduleDistanceFraction`, `dedupeCandidates`) — see
  [D-54](../DECISIONS.md) for the metric and default threshold. Lives in
  plain TS (IMPL.md §3 places dedup in the Coordinator, not Rust), so
  unlike T3/T4 this is directly Vitest-unit-testable with no
  Worker/wasm-boundary involved. 12 new tests
  (`candidateDedup.test.ts`): identical/disjoint/partial-overlap distance
  calculations, the no-placements divide-by-zero guard, empty/single-
  candidate inputs, keeping the better-scoring one of two duplicates
  regardless of input order, threshold sensitivity, and — the one most
  worth calling out — a 3-candidate chain proving a dropped near-duplicate
  is never used as a comparison anchor for a later candidate (only the
  surviving *kept* set is). Full suite (202 tests), lint, and build all
  green.
