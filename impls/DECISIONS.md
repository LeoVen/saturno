# Decisions Log

Every entry here records a point where implementation either **deviated**
from `specs/`, **clarified** something the spec left genuinely open, or made
a standalone **implementation-only** call not covered by the spec at all
(e.g. a library choice, a folder layout). See `PROCESS.md` §5.

`specs/` is never edited to match these — this log, read together with
`specs/`, is the current source of truth. Newest entries at the top.

Template for a new entry:

```
## D-<NN> — <short title>

- **Date**: YYYY-MM-DD
- **Type**: Deviation | Clarification | Implementation-only
- **Spec refs**: FR-#, TR-#, or IMPL.md §# (omit if Implementation-only and genuinely nothing to reference)
- **What changes**: one or two sentences — what actually happens now, vs. what the spec said/left open.
- **Why**: the concrete reason (test result, user call, practical constraint).
- **Affected epics/tasks**: E##-... (so the epic file can point back here)
```

---

## D-01 — Teacher conflicts are detected by real clock time, across Segments

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-3, FR-5, FR-14
- **What changes**: a Teacher can teach in more than one Segment. FR-14's "no Teacher assigned to two Classes in the same time slot" is evaluated by comparing each assignment's **actual start/end clock time** (which every Time Slot already carries per FR-5), not by matching Segment-scoped period indices — two Segments' periods can overlap in real time despite having different structures. Teacher Availability (FR-3) is likewise modeled as time ranges per day, not tied to one Segment's period grid, so a single Teacher's availability applies uniformly across every Segment they teach in.
- **Why**: FR-5 gives each Segment its own independent period structure, so "same time slot" is otherwise ambiguous the moment a Teacher crosses Segments — a real scenario in smaller schools. Confirmed directly with the user; low extra implementation cost since Time Slots already store real clock times.
- **Affected epics/tasks**: E02 (Time Slot model must expose real start/end time), E04 (Teacher Availability grid modeled as time ranges, not per-Segment periods), E06 (Verifier's double-booking check compares real time overlap, not slot-index equality).

## D-02 — Segment daily structure is fixed across weekdays

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-5
- **What changes**: within one Segment, the daily period/break structure (Time Slots + Breaks) is identical for every weekday it applies to — one structure per Segment, not one per (Segment, weekday). FR-5 didn't say either way.
- **Why**: matches how the real sample sheets in `sheets/` are laid out — one shared period-row structure across all weekday columns per segment. Confirmed directly with the user.
- **Affected epics/tasks**: E02 (Time Slot / Break data model).

---

## D-03 — Repo layout: `app/` (frontend) + `solver/` (Rust/WASM crate)

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none directly — PROCESS.md said code lives at repo root "organized however the tooling wants," without pinning an exact layout.
- **What changes**: the Vue/Vite frontend lives under `app/` (its own `src/`, `index.html`, `package.json`, `vite.config.ts`), and the Rust solver crate lives under `solver/` (its own `Cargo.toml`, `src/lib.rs`). Both tools default to a `src/` directory, so they can't share repo root without colliding — subfolders resolve that while keeping each tool's own conventional layout intact. Matches the existing top-level convention of thematic folders (`specs/`, `impls/`, `sheets/`).
- **Why**: a real, unavoidable naming collision, resolved the simplest way rather than renaming either tool's default output directory.
- **Affected epics/tasks**: E01 (all scaffolding tasks); every later epic's file paths follow this layout.

## D-04 — Package manager: npm

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none.
- **What changes**: npm is the JS package manager, not pnpm/yarn.
- **Why**: npm was already available locally (bundled with Node); neither pnpm nor yarn was installed, and there's no stated reason in the specs to prefer either.
- **Affected epics/tasks**: E01.

---

## D-05 — Toolchain versions pinned

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none.
- **What changes**: Node is pinned to `26.7.0` (`app/.nvmrc`); Rust is pinned to `1.97.1` with the `wasm32-unknown-unknown` target and `rustfmt`/`clippy` components (`solver/rust-toolchain.toml`, auto-applied by `rustup` for any command run under `solver/`, including in CI). `wasm-pack` has no version file — it's installed fresh in CI via `cargo install wasm-pack --locked`; not pinned to a specific version yet.
- **Why**: these were simply whatever was already installed locally when E01 started; pinning them stops CI and local dev from silently drifting apart. Not chosen for any specific compatibility reason — revisit if a real reason to pin differently comes up.
- **Affected epics/tasks**: E01.

---

## D-06 — Custom domain: saturno.leoven.dev

- **Date**: 2026-09-20
- **Type**: Clarification (TR-17 already anticipated this exact case: "...unless a custom domain is configured later")
- **Spec refs**: TR-17
- **What changes**: the app is served at `https://saturno.leoven.dev` (user-owned DNS, CNAME record already pointing at `leoven.github.io`, confirmed resolving) instead of the GitHub Pages project-page subpath. Concretely: Vite's `base` is now `/` (was `/saturno/`); `app/public/CNAME` (containing `saturno.leoven.dev`) is committed so it ships in every build and GitHub Pages picks it up; the repo's Pages `cname` setting was also set directly via `gh api -X PUT repos/LeoVen/saturno/pages -f cname=saturno.leoven.dev`.
- **Why**: user-requested, and the exact scenario TR-17's own wording already carved out — not a deviation from what was specified, just resolving the "unless" clause.
- **Note**: right after setting the custom domain, GitHub reported `https_enforced: false`. The certificate provisioned much faster than the ~24h estimate — within minutes it showed `https_certificate.state: "approved"`, so `https_enforced` was flipped to `true` the same session (`gh api -X PUT .../pages -F https_enforced=true` — note `-F` for a real boolean, `-f` sends a string and is rejected). Confirmed via a real push (commit `060d232`): `https://saturno.leoven.dev` serves the app correctly with all assets at root (no `/saturno/` prefix). The plain-HTTP→HTTPS redirect itself hadn't kicked in yet moments after enabling enforcement (still 200, not a redirect) — likely edge-propagation lag; worth a quick recheck later, not treated as blocking.
- **Affected epics/tasks**: E01 (E01-T4's base-path config, E01-T5's deploy pipeline — the artifact must keep including `CNAME` on every build).

---

## D-07 — Time Slots/Breaks: auto-sorted by start time, no manual reorder UI

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-5
- **What changes**: FR-5 calls for an "ordered set" of Time Slots per Segment. Rather than a manually reorderable list (drag-and-drop, up/down buttons), the entities store re-sorts a Segment's `timeSlots`/`breaks` arrays by start time on every add/edit — array order *is* chronological order, always. Same treatment for Breaks (also ordered, per FR-5's "multiple breaks per day at different times").
- **Why**: periods and breaks within a school day are inherently chronological — there's no real scenario where a school wants Time Slot 2 to display before Time Slot 1 despite starting later. Sorting automatically satisfies "ordered" with far less UI complexity than reorder controls, and removes an entire class of user error (an out-of-order period list).
- **Affected epics/tasks**: E02-T2, E02-T3, E02-T4.

## D-08 — Segment/Time Slot/Break IDs via `crypto.randomUUID()`

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none.
- **What changes**: entity IDs are generated with the browser-native `crypto.randomUUID()`, not a `uuid` npm dependency.
- **Why**: available natively in every supported target browser (and in Node/jsdom for tests) — no reason to add a dependency for something the platform already provides.
- **Affected epics/tasks**: E02; the same convention should be followed by later entities (E03+) unless a real reason to deviate comes up.

## D-09 — E01's scaffolding UI (WASM ping, persistence smoke-test) removed in E02

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none.
- **What changes**: `App.vue`'s throwaway WASM-ping and persistence-smoke-test sections (and the `scaffoldCheck` Pinia store backing the latter) are deleted, replaced by the real Segments configuration UI. The underlying WASM/Worker wiring (`solver.worker.ts`, the `wasm/pkg` build output) is untouched and unused until E06 needs it.
- **Why**: E01's own notes flagged this UI as "throwaway scaffolding, not a real screen," to be replaced once E02 wrote the first real pt-BR screen — this is that replacement. The entities store + `SegmentsConfig.vue` now demonstrate the same persistence round-trip for a real reason.
- **Affected epics/tasks**: E02 (all tasks); E01 (retroactively closes the note left in E01's file).

---

## D-10 — School week is Monday–Friday

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-3, TR-10
- **What changes**: Teacher Availability (and, implicitly, the schedule grid generally) is modeled over a fixed 5-day week (`mon`..`fri`) rather than an arbitrary/configurable weekday set.
- **Why**: TR-10's scale assumption explicitly says "5-day weeks," and every real sample sheet in `sheets/` only has Monday–Friday columns — no evidence any Saturday/Sunday scheduling is in scope. Hardcoding this avoids a configurable-weekday-set feature nobody asked for.
- **Affected epics/tasks**: E04 (Availability model); implicitly every later epic that renders a weekly grid (E06+, E08+).

## D-11 — Teacher Availability defaults to fully available; the user records exceptions

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-3
- **What changes**: a new Teacher starts with no `UnavailabilityRange`s, meaning available at every time. The user records specific (weekday, start, end) ranges where the Teacher is *not* available, rather than opting in to availability period-by-period. Combined with D-01, a range is an arbitrary real clock-time interval, not tied to any one Segment's period grid.
- **Why**: FR-3 asks for a grid marking each day/period available or unavailable, but for the common case (a full-time teacher with a few known exceptions, e.g. "unavailable Tuesday afternoons") an opt-out model needs far less data entry than checking dozens of period cells across every Segment's grid — and, per D-01, there's no single shared grid to check cells against once a Teacher crosses Segments. This is a genuinely new implementation call (not explicitly settled by FR-3's wording), made here rather than deferred.
- **Affected epics/tasks**: E04 (Availability model, config UI); E06 (Verifier must treat "no matching UnavailabilityRange" as available, not the reverse).

---

## D-12 — Assignment: FR-8/9/10/12 combined into one entity, with a Teacher pool (not a single Teacher)

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-8, FR-9, FR-10, FR-12, FR-36
- **What changes**: a single `Assignment` entity, keyed by (Class, Subject), carries `weeklyOccurrences` (FR-8), `consecutivePeriods` (FR-10, capped at 3), `allowSameDayRepetition` (FR-12), and `teacherIds: string[]` (FR-9) — one entity rather than splitting the weekly-count/period-shape config from the Teacher relationship. `teacherIds` holds *one or more* Teachers, not exactly one.
- **Why**: FR-8/10/12 all describe config scoped to one (Class, Subject) pair, so one entity avoids an artificial split with no other justification. The array (vs. a single `teacherId`) is because FR-36 (repair) explicitly reuses "another Teacher already configured for that (Class, Subject) pair" — the schema needs room for that substitute pool from the moment Assignments are introduced, not bolted on later. Every Teacher in the list is a legitimate teacher of that (Class, Subject); which one is used for a normal generation vs. which for repair is a solver-time concern (E06/E14), not a data-model one.
- **Affected epics/tasks**: E05 (Assignment entity/UI); E06 (Constructor picks among `teacherIds`); E14 (Repair's substitute pool is exactly `teacherIds` minus the absent Teacher).

## D-13 — FR-13 validation: precise definitions of "available periods" and "zero overlap"

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-13
- **What changes**: two precise, testable definitions for FR-13's prose: (1) a Class's "available non-break periods" = its Grade's Segment's Time Slot count-per-day × 5 weekdays (D-02's fixed structure, D-10's 5-day week) — Breaks are already excluded since they're not Time Slots. The overload check sums `weeklyOccurrences` across *all* of a Class's Assignments and compares against this figure, not per-Assignment. (2) "zero overlapping availability" for a Teacher assigned to a (Class, Subject) = *every single one* of the Class's weekly periods (across all 5 weekdays) falls inside some `UnavailabilityRange` of that Teacher — i.e. there is no time the Teacher could ever teach that Class, not merely a busy-but-not-impossible schedule.
- **Why**: FR-13 states the checks at the level of intent ("exceeds the number of non-break periods," "zero overlapping availability") without pinning down the arithmetic — needed a concrete, unit-testable definition to implement against.
- **Affected epics/tasks**: E05 (`entities/validation.ts`'s `findOverloadedClasses`/`findZeroOverlapAssignments`, unit-tested per TR-11).

---

## D-14 — "Interlude" epics: cross-cutting UX/quality work outside the E&lt;NN&gt; sequence

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: none — this is about the planning process (PROCESS.md), not the frozen spec.
- **What changes**: an epic that isn't derived from a specific FR (a navigation/visual/quality rework spanning already-built screens, rather than new functionality) is named `INTERLUDE-N` instead of `E<NN>`, and its file/BOARD.md row is inserted at the point in the sequence where the work actually happens rather than appended after E14. The `E<NN>` numbering stays reserved for FR/TR-traceable epics so existing cross-references (DECISIONS.md entries, commit messages) never need renumbering.
- **Why**: user explicitly requested an epic to "tackle the UI and UX" before continuing to E06 — this is real, worth tracking the same way as any other epic (a file, tasks, a Human Verification checklist), but forcing it into the FR-traceable `E<NN>` sequence would misrepresent it as spec-derived work and would require renumbering every later epic (E06→E07, etc.) for no real benefit.
- **Affected epics/tasks**: INTERLUDE-1 (first instance); `impls/BOARD.md`'s table, which now has a non-`E<NN>` row between E05 and E06.

## D-15 — WeekGrid is a visual layer; Teacher Availability's grid rows come from configured Segments' Time Slots

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-3, FR-5, D-01
- **What changes**: the new `WeekGrid` component (INTERLUDE-1-T4) is purely a friendlier editor for data that already exists — Segment Time Slots/Breaks (real clock times, D-02's fixed-per-weekday structure) and Teacher UnavailabilityRanges (D-01's arbitrary time ranges, independent of any one Segment). For Teacher Availability specifically, since D-01 deliberately keeps availability un-tied to any single Segment's period grid, the grid's row boundaries are derived at render time from the **union of every configured Segment's Time Slot start/end times** (deduplicated, sorted) — not a new fixed granularity, and not a data-model change. With no Segments configured yet, it falls back to a plain hourly grid (07:00–19:00) so the screen isn't empty before any Segment exists.
- **Why**: gives a visually real "calendar" without inventing a new time-grid concept that would need its own reconciliation against Time Slots later — the grid always reflects whatever periods the school has actually configured.
- **Affected epics/tasks**: INTERLUDE-1-T4, T5, T6.

## D-16 — TimeInput: always 24h, 5-minute steps, native `<input type="time">` dropped everywhere

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-5
- **What changes**: every time entry point in the app (Time Slots, Breaks, Teacher Availability, and any future one) moves from the native `<input type="time">` to a custom `TimeInput` component: two `<select>`s (hour 00–23, minute 00/05/…/55). Native `<input type="time">` is removed entirely, not just supplemented.
- **Why**: the native control renders in whatever 12h/24h format the browser/OS locale dictates — confirmed actually happening (AM/PM shown) in E02–E05's own agent-driven verification screenshots, not a hypothetical risk. There is no HTML attribute to force 24h display, so a custom control is the only fix. 5-minute steps because every real time in the PRD's sample sheets (08:40, 08:55, 10:35, 10:50, etc.) already lands on a 5-minute boundary — confirmed acceptable with the user; revisit if a real 1-minute-precision need ever comes up.
- **Affected epics/tasks**: INTERLUDE-1-T3 (component), T5/T6 (call sites); every future epic doing time entry uses `TimeInput`, not a raw `<input type="time">`.

## D-17 — Same-name Teacher disambiguation: no raw id, a display-only ordinal instead

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-2
- **What changes**: the `#xxxx` UUID-fragment badge added in E04 to satisfy FR-2's "distinguishable in a list" is removed. Disambiguation instead relies on (a) selection always happening by clicking the actual row/entry, never by typing a name to match, and (b) a display-only ordinal suffix — e.g. "Guilherme (2)" — computed at render time by counting same-named Teachers in store array order (insertion order, stable across reloads), shown only when 2+ Teachers actually share a name. Nothing is stored or randomly generated for this.
- **Why**: the id badge was a real implementation-detail leak — a random UUID fragment means nothing to a school administrator. User flagged this directly; FR-2's actual requirement (distinct, distinguishable entities) doesn't require exposing the id at all once selection is click-based.
- **Affected epics/tasks**: INTERLUDE-1-T7 (`TeachersConfig.vue`, `AssignmentsConfig.vue`'s Teacher labels).

---

## D-18 — Consecutive-period blocks: floor division, remainder placed independently

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-8, FR-10, FR-14
- **What changes**: an Assignment's `weeklyOccurrences` decomposes into
  placement blocks of `consecutivePeriods` size by floor division —
  `weeklyOccurrences / consecutivePeriods` full blocks, plus one smaller
  block for any remainder (e.g. 5 weekly occurrences at `consecutivePeriods:
  2` -> two double-period blocks + one single period). `verify`'s
  `ConsecutiveBlockBroken` check uses the same arithmetic: it requires at
  least that many maximal same-day contiguous runs of length >=
  `consecutivePeriods` among the actual placements.
- **Why**: FR-8/FR-10 don't pin down what happens when `weeklyOccurrences`
  isn't a clean multiple of the block size — needed a concrete, testable
  rule for both the Constructor and `verify` to share.
- **Affected epics/tasks**: E06-T1, E06-T2.

## D-19 — `generateQuick` is a distinct WASM export from the eventual `generate(input, timeBudgetMs)`

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: IMPL.md §4.3, §5.5
- **What changes**: E06 exposes `generateQuick(input) -> GenerateResult`
  (Constructor only, no time budget) rather than IMPL.md §4.3's
  `generate(input, timeBudgetMs)`. The Refiner/Scorer that turn this into a
  time-boxed, ranked multi-candidate search (deep mode, FR-32-34) are E13's
  job; `generateQuick` is what E06-T3 means by "expose `generate`'s
  quick-mode path."
- **Why**: avoids committing to the final chunked/streaming `generate` call
  shape (progress messages, cancellation) before E13 actually needs it —
  quick mode has none of that, so a separate, simpler export is more honest
  than a `generate` that ignores its own `timeBudgetMs` parameter.
- **Affected epics/tasks**: E06-T3; E13 will need to decide whether
  `generateQuick` stays as a thin wrapper around the eventual `generate` or
  is retired in its favor.

## D-20 — Constructor backtracking is bounded by a fixed step budget

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-16, IMPL.md §5.1, TR-10
- **What changes**: the Constructor's backtracking search stops after a
  fixed number of commit/backtrack steps (`SEARCH_BUDGET`,
  `solver/src/constructor.rs`) rather than exhausting the full search tree.
  FR-16's infeasibility report is built from the single deepest dead-end
  reached within that budget — for a genuinely infeasible school this is
  the same dead-end a full search would find (task ordering makes early
  dead-ends the ones that matter in practice), but for a pathologically
  hard-but-feasible school the budget could in principle be exhausted
  before a solution is found, misreporting it as infeasible.
- **Why**: IMPL.md §5.1 itself already frames this as "within a bounded
  backtracking effort" — an unbounded search has no guarantee of finishing
  within TR-10's few-seconds target. Verified empirically (E06-T7) that the
  budget comfortably solves TR-10's target scale in well under a second.
- **Affected epics/tasks**: E06-T2, E06-T4, E06-T7.

## D-21 — FR-11's `minConsecutivePeriods` is best-effort during construction

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-11, FR-14
- **What changes**: the Constructor prunes candidate placements against a
  Teacher's `maxPeriodsPerDay` and `maxConsecutivePeriods` (rejecting a
  placement that would violate either), but does not prune against
  `minConsecutivePeriods` — a generated schedule can end up with an
  isolated single period for a Teacher who has a minimum-block-size limit
  configured. `verify` still checks `minConsecutivePeriods` and reports a
  `TeacherConsecutiveLimitViolated` violation if so, so the gap is visible
  (and matters for FR-18 conflict flags once manual editing exists), just
  not guaranteed to be avoided by generation itself.
- **Why**: enforcing a minimum block size during a single greedy forward
  pass would require holding placements open pending a *later* task filling
  in the rest of the minimum block — meaningfully more solver complexity
  for a limit expected to be rare in practice (E06's scope is quick-mode
  feasibility; true optimization against soft/rare constraints is more in
  the spirit of E13's Refiner).
- **Affected epics/tasks**: E06-T2, E06-T6.

## D-22 — Two distinct notions of "consecutive periods"

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-10, FR-11, FR-14, D-01
- **What changes**: the solver uses two different adjacency definitions,
  both called "consecutive" in the spec but answering different questions:
  (1) **Time-Slot-index adjacency** — two placements are consecutive if
  they occupy adjacent positions in a Class's Segment's ordered Time Slot
  list (D-02), even if a Break sits between them in real clock time. This
  is what FR-10's double/triple-period blocks and the 3-period ceiling
  check. (2) **Real clock-time back-to-back adjacency** (zero gap between
  one period's end and the next's start) — this is what a Teacher's own
  FR-11 `min`/`maxConsecutivePeriods` limits check, consistent with D-01's
  real-time (not slot-index) modeling of a Teacher's day, since a Teacher
  can cross Segments with different period grids.
- **Why**: FR-10's "consecutive periods" is about a Class's own period
  sequence (a school's notion of "next period," Break or not), while FR-11's
  is about a Teacher's actual working-time contiguity across possibly
  different Segments — conflating the two would either break FR-10's
  intent (a "double period" split by a Break wouldn't count) or D-01's
  cross-Segment modeling for Teachers.
- **Affected epics/tasks**: E06-T1, E06-T2.

## D-23 — Duplicating a Schedule Version: default name, no up-front prompt

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-24
- **What changes**: clicking "Duplicar" on a Schedule Version immediately
  creates a copy named `"{original name} (cópia)"` and makes it the active
  version, rather than prompting for a name first. The user renames it
  afterward (inline, same as any other version) if they want something
  else.
- **Why**: keeps the interaction to one click for the common case, and
  reuses the same inline-rename control every version already has instead
  of a second, one-off naming UI.
- **Affected epics/tasks**: E07-T3 (`ScheduleVersionsView.vue`).

*(entries above are the most recent)*
