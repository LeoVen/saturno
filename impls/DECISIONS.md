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

## D-24 — Per-Teacher view rows: the same cross-Segment union as Teacher Availability

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-21, D-01, D-15
- **What changes**: `TeacherScheduleGrid.vue`'s rows are `entities.availabilityGridPeriods`
  (D-15's deduplicated, sorted union of every configured Segment's Time
  Slots) rather than one Segment's own period list. A placement's real
  clock time (resolved via its Class's Segment, D-01) is matched to a row
  by exact (start, end).
- **Why**: a Teacher can cross Segments with different period grids (D-01),
  so there's no single "the" period list to use for a Teacher's own weekly
  row — the same problem D-15 already solved for the Availability grid,
  reused here rather than inventing a second cross-Segment merge.
- **Affected epics/tasks**: E08-T2.

## D-25 — Teacher ↔ Subject qualification, to narrow the Assignment Teacher picker

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-9, D-12
- **What changes**: Teacher gains `subjectIds: string[]` — the Subjects that
  Teacher can teach, configured on the Teachers screen (a "Disciplinas que
  leciona" checklist). The Assignments screen's Teacher checklist (FR-9)
  now shows only Teachers qualified for that Assignment's Subject, plus any
  Teacher already selected on it even if not (or no longer) qualified — so
  existing data is never silently hidden. This is a UI-only filter: it adds
  no new hard constraint to the solver (E06) or FR-13's validation, and an
  Assignment's `teacherIds` (D-12) is unaffected in shape. Every read of
  `subjectIds` defaults to `[]` (`?? []`), since Teacher records persisted
  before this field existed don't have it.
- **Why**: user-requested — with many Teachers and Subjects, picking from
  the full unfiltered Teacher list per Assignment is tedious; most schools
  only have a handful of Teachers per Subject.
- **Affected epics/tasks**: E04 (`Teacher` entity, `TeachersConfig.vue`)
  and E05 (`AssignmentsConfig.vue`'s Teacher picker) — both already `done`;
  this is a retrofit, not a reopening of either epic's own checkpoint.

## D-26 — Manual reordering for Teachers and Subjects (up/down, no drag-and-drop)

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-2, FR-7
- **What changes**: the Teachers and Subjects lists gain "▲"/"▼" buttons to
  move an entry one position at a time; the store's `teachers`/`subjects`
  array order (already what every list/dropdown renders in) is the
  persisted order. Backed by a pure `moveItem` helper
  (`app/src/entities/reorder.ts`, TR-11 pattern) shared by both.
- **Why**: user-requested. Contrast with D-07 (Time Slots/Breaks are
  auto-sorted chronologically, no manual reorder): Teachers and Subjects
  have no natural sort key, so there's no chronological order to derive —
  manual positioning is the only option, and up/down buttons avoid adding
  a drag-and-drop dependency for a two-list, occasional-use feature.
- **Affected epics/tasks**: E04 (`TeachersConfig.vue`), E03
  (`SubjectsConfig.vue`) — both already `done`; a retrofit, not a
  reopening of either epic's checkpoint.

## D-27 — Assignments screen: bulk-copy between Classes, table filters, weekly-load summary

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-8, FR-9
- **What changes**: three additions to the Assignments screen, all
  user-requested as the school's data grows: (1) "Copiar atribuições entre
  turmas" — copies every field of a source Class's Assignments (weekly
  occurrences, consecutive-periods block, same-day override, Teachers)
  onto a target Class; a Subject already configured on the target is
  skipped, never overwritten. (2) Turma/Disciplina filters on the
  "Atribuições cadastradas" table. (3) "Total de aulas por semana" — every
  Class's current weekly load vs. its Segment's available periods (the
  same figures FR-13's overload check already computes, now surfaced for
  every Class via a new `classLoads` getter, not just overloaded ones), so
  the user can sanity-check their own data entry.
- **Why**: user-requested — with many Classes/Subjects, re-entering
  identical config for parallel sections is tedious, the flat table gets
  hard to scan, and there was no at-a-glance way to confirm a Class's
  weekly load is complete without cross-checking the overload warning
  (which only fires when *over*, not simply to confirm a total).
- **Affected epics/tasks**: E05 (`AssignmentsConfig.vue`,
  `entities.ts`'s `copyAssignments`/`classLoads`) — already `done`; a
  retrofit, not a reopening of its checkpoint.

## D-28 — Grade reordering within a Segment, and every Class picker follows structural order

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-6, D-26
- **What changes**: Grades gain the same up/down reordering as Teachers/
  Subjects (D-26), scoped to their own Segment — `grades` is one flat
  array shared across every Segment, so the new `moveItemWithinGroup`
  helper swaps only against a same-Segment neighbor, never reaching into
  another Segment's Grades. Separately (and just as load-bearing): every
  "pick any Class" dropdown across the app (Assignments, the Schedule
  Grid, the weekly-load summary) previously re-sorted alphabetically by
  the "Segment / Grade / Class" label string, which would have silently
  overridden any Grade (or Segment) ordering the user set up. Those now
  render from a new `orderedClasses` getter — Segment order, then Grade
  order within it, then Class order within its Grade — so a picker
  reflects the order the user actually arranged, not a relabeling. The
  Per-Teacher view's Teacher picker had the same alphabetical-relabeling
  bug for Teachers (missed when D-26 landed) and is fixed the same way.
- **Why**: user-requested for Grades specifically — "I don't want to
  punish the user for having created them initially out of order and then
  the dropdown is not in order that they expect." Fixing only the Grade
  reorder action without also fixing the alphabetical-sort pickers would
  have left the feature invisible everywhere except the Séries e Turmas
  screen itself.
- **Affected epics/tasks**: E03 (`GradesClassesConfig.vue`,
  `entities.ts`'s `moveGrade`/`orderedClasses`) and E05
  (`AssignmentsConfig.vue`), both already `done`, plus `ScheduleGrid.vue`
  (shared by E06/E07) and `TeacherScheduleGrid.vue` (E08) — those two
  still `in-review`, so this isn't a reopening of any epic's checkpoint
  either way, just an amendment to files those epics already introduced.

## D-29 — Teacher Availability/schedule grids: one block per Segment, not merged

- **Date**: 2026-09-20
- **Type**: Clarification (supersedes D-15's flat-merge design)
- **Spec refs**: FR-3, D-01, D-15, D-24
- **What changes**: the Teacher Availability grid (Professores) and the
  Per-Teacher schedule view (E08, FR-21) now render one `WeekGrid` per
  Segment, each labeled with the Segment's name, instead of merging every
  Segment's Time Slots into a single flat, time-sorted row list. The store
  getter backing this is renamed `availabilityGridGroups` (was
  `availabilityGridPeriods`), returning one group per Segment (falling
  back to a single ungrouped hourly grid when no Segment has any Time Slot
  yet) instead of one deduplicated flat array — `distinctSortedRanges`
  (only ever used by the old getter) is removed as dead code.
- **Why**: user-reported — two Segments' Time Slots can genuinely
  interleave in real time (e.g. 08:40-09:30 next to 08:55-09:45) without
  being the same period sequence (D-01), and a single merged grid made
  this look like one continuous run of back-to-back periods, which isn't
  what's happening and was actively confusing to read.
- **Affected epics/tasks**: E04 (`TeachersConfig.vue`, `entities.ts`),
  already `done`; E08 (`TeacherScheduleGrid.vue`), still `in-review` —
  neither epic's checkpoint is reopened, this amends files they introduced.

## D-30 — Teachers list: one-off "Ordenar por nome (A-Z)" bulk sort

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-2, D-26
- **What changes**: a button on the Professores screen bulk-sorts
  `teachers` alphabetically by name in one action (`sortTeachersByName`).
  It's a one-off rewrite of the same manually-editable order D-26
  introduced, not a standing invariant — `moveTeacher` still freely
  reorders the list afterward.
- **Why**: user-requested, right after D-26/D-28 — a fast way to reach a
  sensible starting order (most schools would want alphabetical by
  default) without giving up the ability to hand-tune it afterward (e.g.
  grouping a few Teachers together regardless of name).
- **Affected epics/tasks**: E04 (`TeachersConfig.vue`), already `done`; a
  retrofit, not a reopening of its checkpoint.

## D-31 — Teacher Availability grid: per-day, per-Segment toggle button

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-3
- **What changes**: each Segment's Availability grid (D-29) gets a
  "Bloquear dia"/"Liberar dia" button in every weekday column header,
  toggling every period of that weekday within that Segment's grid in one
  click, instead of clicking each cell. The button reads "Liberar dia"
  only when every period of that day is already unavailable, and
  "Bloquear dia" otherwise (including a partially-blocked day) — clicking
  it always drives the day fully to the opposite of its current state.
  `WeekGrid.vue` gains an optional `col-header` scoped slot (falling back
  to the plain label) to carry this without becoming Teacher-Availability
  -specific.
- **Why**: user-requested — marking a Teacher fully unavailable for a
  whole day (e.g. a fixed day off) previously meant clicking every period
  cell individually.
- **Affected epics/tasks**: E04 (`TeachersConfig.vue`), already `done`;
  `WeekGrid.vue`'s new slot is additive and doesn't change any existing
  consumer's behavior. A retrofit, not a reopening of E04's checkpoint.

## D-32 — Assignment defaults: double period + same-day repetition allowed

- **Date**: 2026-09-20
- **Type**: Implementation-only
- **Spec refs**: FR-10, FR-12
- **What changes**: a newly created Assignment now defaults to
  `consecutivePeriods: 2` (double period) and `allowSameDayRepetition:
  true`, instead of `1` (no block) and `false`. `weeklyOccurrences` stays
  at `1`. Only affects new Assignments going forward — existing ones are
  untouched.
- **Why**: user-reported from actually filling in real Assignment data —
  double periods with same-day repetition allowed turned out to be the
  common case, not the exception, so it's less clicking to default there
  and override for the minority that need independent single periods
  and/or the stricter no-repeat rule.
- **Affected epics/tasks**: E05 (`entities.ts`'s `addAssignment`), already
  `done`; a retrofit, not a reopening of its checkpoint.

## D-33 — Constructor task ordering: scarce-Teacher Assignments go first

- **Date**: 2026-09-20
- **Type**: Clarification (refines D-20's search heuristic)
- **Spec refs**: FR-14, FR-16, TR-9, TR-10
- **What changes**: the Constructor's task-ordering heuristic
  (`solver/src/constructor.rs::build_tasks`) now sorts Assignments whose
  Teacher pool has the fewest open weekdays (least "no unavailability
  recorded" days, a coarse flexibility proxy) *first*, ahead of the
  existing class-load/teacher-pool-size/block-size tiebreakers. Also
  raises `SEARCH_BUDGET` from 500,000 to 2,000,000 commit-steps as extra
  backtracking headroom (still comfortably under a second at TR-10 scale).
- **Why**: user-reported — a Teacher available only 2 days/week teaching
  one Subject to 3 Classes was reported infeasible ("Beck: nenhum horário
  disponível...") despite the numbers clearly fitting. The previous
  ordering had no notion of a Teacher's *availability breadth*, only pool
  *size* — a single-Teacher Assignment with a fully-flexible Teacher sorted
  identically to one with a heavily-restricted Teacher, so a
  less-constrained Subject sharing the same Classes could grab a scarce
  Teacher's only usable weekdays simply by being tried first (Monday is
  always attempted before Tuesday), forcing backtracking that may not
  finish within budget. This is a standard CSP "fail first"
  most-constrained-variable technique, now applied to the dimension that
  actually matters (day-flexibility, not just pool cardinality).
  **Not independently reproduced**: several attempts (isolated, embedded
  in a synthetic 16-class/40-teacher busy schedule) to reconstruct the
  exact failure both succeeded even before this change — the fix is
  applied on the strength of the failure-mode reasoning above and the
  general engineering value of a better CSP heuristic, not a confirmed
  root-cause match. If it still occurs, it needs the actual failing
  configuration to pin down further.
- **Affected epics/tasks**: E06 (`constructor.rs`), status `done` — a
  correctness refinement to an already-shipped module, not a reopening of
  the epic's checkpoint.

## D-34 — Export/Import: a "Dados" screen with both file and copy/paste paths

- **Date**: 2026-09-21
- **Type**: Implementation-only
- **Spec refs**: FR-23, TR-7, TR-12
- **What changes**: a new "Dados" sidebar section holds Export (a
  download-file button, a "Copiar JSON" clipboard button, and the JSON
  itself visible in a read-only textarea) and Import (a file picker and a
  paste-JSON textarea, either triggering the same `parseImport`). Import
  replaces every current entity and Schedule Version and is gated behind a
  native `confirm()` since it's otherwise irreversible from the UI.
- **Why**: user-requested, specifically to get their real (failing)
  configuration out of the app as JSON to hand over for solver debugging —
  the visible/copyable textarea serves that directly, alongside the
  file-based path FR-23 itself asks for.
- **Affected epics/tasks**: E11 (all tasks) — the epic's first
  implementation, not a retrofit.

## D-35 — Constructor bug found: same-day blocks of one Assignment couldn't merge

- **Date**: 2026-09-21
- **Type**: Clarification (corrects a Constructor bug, not a spec change)
- **Spec refs**: FR-12, FR-14, D-13, D-33
- **What changes**: root-caused the Beck-style infeasibility report (D-33)
  using the user's real exported data (thanks to E11's new Export screen).
  The actual bug: when an Assignment's `weeklyOccurrences` doesn't divide
  evenly by `consecutivePeriods`, it decomposes into multiple blocks (D-18,
  e.g. 5 at block-size 2 -> blocks of 2, 2, 1). The Constructor's
  same-day-repetition check rejected placing a *second* block of that
  Assignment on any day that already had one, even when the new block
  would land immediately adjacent and merge into a single legitimate run
  (≤3 periods, the FR-10 ceiling) — which is exactly what `verify.rs`
  itself already treats as valid (its rule is "no more than one *run* per
  day," not "no more than one placement"). The Constructor was stricter
  than its own Verifier, silently pruning genuinely feasible placements.
  This was the real school's actual blocker: a Teacher restricted to
  exactly as many days as their Assignment's block count, solvable only by
  merging two of those blocks on one day — which the Constructor refused
  to even try. Fixed by replacing the per-day skip with a precise
  per-candidate check (`would_leave_separate_run`) matching `verify.rs`'s
  own definition. Confirmed fixed against the real 8-class, 103-Assignment,
  **fully zero-slack** (every Class exactly saturated — 30/30, 25/25 —
  which turns out to be normal real-school usage, not an edge case) export:
  infeasible for ~74s under the old code, feasible in ~2s after the fix,
  with `SEARCH_BUDGET` unchanged at D-33's 2,000,000.
- **Why**: a real, reproducible correctness bug, found by the user sharing
  their actual (fully saturated) school data — something no synthetic test
  in this repo had modeled, since every prior test used deliberately
  "light load" schools. The exported data was used only locally to
  diagnose and verify the fix — **never committed**, since this repo is
  public and the export contains real Teachers' names; the permanent
  regression test (`same_day_blocks_of_one_assignment_may_merge_when_repetition_is_disallowed`)
  distills the same structural bug with synthetic names instead.
- **Affected epics/tasks**: E06 (`constructor.rs`), status `done` — a
  correctness fix to an already-shipped module, not a reopening of the
  epic's checkpoint.

## D-36 — Human-Readable Export: new components, not `@media print` on the existing grid components

- **Date**: 2026-09-21
- **Type**: Implementation-only (corrects an unworkable literal reading of IMPL.md §9)
- **Spec refs**: FR-22, TR-13, IMPL.md §9
- **What changes**: IMPL.md §9 describes the printable path as "a
  `@media print` stylesheet applied to the same grid components used for
  the on-screen FR-20/21 views." In practice `ScheduleGrid.vue` and
  `TeacherScheduleGrid.vue` render one Class (or Teacher) at a time,
  picked from a dropdown, with weekdays as columns — there is no on-screen
  DOM holding "every Class in a Segment, side by side" the way every real
  sample sheet in `sheets/` lays it out (columns = Classes, two days
  stacked per row-block). CSS alone cannot reshape that DOM into the
  target layout — it would need to duplicate row-header content per day
  pair and re-key columns from weekdays to Classes, which is a content
  change, not a stylesheet. Built a new shared view-model instead
  (`src/export/scheduleExport.ts`, pure/unit-tested per TR-11) plus a new
  `ExportView.vue` that renders off it directly in the two-days-per-row
  shape (with its own `@media print` rules for pagination/hiding chrome),
  and an `.xlsx` builder reading the same view-model. `ScheduleGrid.vue`/
  `TeacherScheduleGrid.vue` are untouched — they remain the interactive
  on-screen views (FR-20/21 proper); the export is a separate rendering of
  the same underlying Schedule Version data, not a print-mode of the same
  components.
- **Why**: matching the spec's literal mechanism (`@media print` on the
  existing components) isn't achievable without content changes CSS can't
  express, and would produce the wrong layout anyway (one Class at a time
  instead of the whole-Segment grid every real sample sheet actually
  shows). The *outcome* IMPL.md §9 and FR-22 actually ask for — output
  "comparable to the school's existing timetable format" — is what's
  preserved; only the stated mechanism changes.
- **Affected epics/tasks**: E12-T1/T2, both `new` at the time of this
  decision.

## D-37 — Per-Teacher schedule view: one merged grid per Teacher, with Gaps shown

- **Date**: 2026-09-21
- **Type**: Clarification (narrows D-29 for this one screen)
- **Spec refs**: FR-15 (Gap/Janela), FR-21, D-01, D-29
- **What changes**: the Per-Teacher schedule view (`TeacherScheduleGrid.vue`,
  FR-21 — **not** the Teacher Availability grid on Professores, which stays
  exactly as D-29 left it) now renders exactly one grid per Teacher instead
  of one per Segment. For a Teacher who only teaches in one Segment (most
  of them) this looks the same as before, just without D-29's blank
  grids for every *other* configured Segment they don't actually teach in
  (`gridGroups` previously iterated every Segment regardless of the
  selected Teacher). For a Teacher who crosses Segments, their Time
  Slots/Breaks are merged into one chronological row axis
  (`entities/teacherSchedule.ts`, pure/unit-tested per TR-11) rather than
  shown as separate per-Segment tables. Any real idle time between an
  assignment ending in one Segment and the next starting in another is
  rendered as a distinct "Janela" cell (hatched) — this is FR-15's Gap,
  previously only used internally by the Solver's Soft Objective and never
  surfaced in any view. `WeekGrid.vue` gained an optional `variant` field
  on `WeekGridRow` (applied as a CSS class to that row's header + cells)
  to let this component mark Break rows as a visual divider, reusable by
  future consumers.
- **Why**: user-requested, after noticing the segment-crossing case in
  real data — for a Teacher who teaches in one Segment, a table per
  Segment is one extra empty table's worth of noise (D-29 grouped by
  *every configured* Segment, not by *this Teacher's* Segments); for one
  who crosses Segments, separate tables hide the fact that a 10-15 minute
  gap opens up between them (visible in the real school's data — Segment
  Time Slots that don't line up, e.g. EF's 08:40-09:30 next to EM's
  08:55-09:45). D-29's "don't merge" rule was written for the *generic,
  editable* Teacher Availability grid, where merging is genuinely
  ambiguous because there's no specific Teacher's actual placements to
  anchor which Segment a given cell belongs to. The Per-Teacher schedule
  view is different: it's read-only and already anchored to one specific
  Teacher's actual placements, so merging is unambiguous and is what
  correctly answers "what does this Teacher's day look like."
- **Affected epics/tasks**: E08 (`TeacherScheduleGrid.vue`), already
  `done` — a UI improvement to an already-shipped screen, not a reopening
  of the epic's checkpoint.

## D-38 — Two real bugs found building E09's live conflict flag (FR-18)

- **Date**: 2026-09-21
- **Type**: Implementation-only (bug fixes to already-shipped E06 code, found while building a new feature that finally exercised them)
- **Spec refs**: FR-18, IMPL.md §4.1/§7
- **What changes**:
  1. `generationCoordinator.ts`'s `verifySchedule(input, schedule)` never
     JSON-cloned its `schedule` argument before handing it to
     `postMessage` — unlike `buildScheduleInput`, which already does this
     for `input`. Every real call passes a Pinia-reactive `ScheduleVersion.schedule`
     Proxy, and `postMessage` cannot structured-clone that: it throws
     `DataCloneError` synchronously, at call time. `ScheduleGrid.vue`'s
     conflict-flag watcher already wraps the call in `try/catch` (by
     design, so a `verify` failure never blocks an edit — FR-18), so this
     failed completely silently: no console error, no visible symptom
     beyond "the conflict flag never appears." Fixed by cloning `schedule`
     the same way `input` already was.
  2. `solver/src/model.rs`'s `Violation` enum has `#[serde(tag = "type",
     rename_all = "camelCase")]` on the enum itself — which only renames
     the `type` tag (e.g. `"teacherDoubleBooked"`), not each struct-like
     variant's own fields. Every variant's fields (`teacher_id`,
     `class_id`, `time_slot_id`, `run_length`, ...) were serializing as
     snake_case on the wasm wire, while `app/src/wasm/types.ts`'s
     hand-written `Violation` TS union claims camelCase throughout. Fixed
     by adding `#[serde(rename_all = "camelCase")]` to each variant too; a
     new Rust test (`model::violation_serialization_tests`) asserts the
     JSON shape directly so this can't silently regress. Wasm rebuilt.
- **Why**: both bugs are real and have existed since E06 shipped
  `verify`/`Violation`, but nothing before E09 ever read a `Violation`
  field beyond `.message` (FR-16's infeasibility report only surfaces
  `.message` too) or called `verifySchedule` with a live reactive
  `Schedule` — so both were completely invisible until E09's conflict-flag
  UI became the first real consumer. Found by browser-driven verification
  against a small synthetic fixture designed specifically to trigger a
  `TeacherDoubleBooked` violation (E12-style local dev-server + headless
  Chromium session, not committed), not by any existing automated test.
- **Affected epics/tasks**: E06 (`generationCoordinator.ts`, `model.rs`),
  status `done` — correctness fixes to already-shipped modules, not a
  reopening of that epic's checkpoint; discovered and fixed while
  building E09-T2.

## D-39 — Manual Editing moved to its own screen, always on an explicit draft copy

- **Date**: 2026-09-21
- **Type**: Clarification (corrects where E09 landed E06-first-pass, after direct user feedback on the shipped result)
- **Spec refs**: FR-17, FR-18, FR-19, FR-24
- **What changes**: FR-17's move/swap and FR-19's Notes no longer live on
  "Visualizar Horário" (E08) — they moved to a new "Ajustar Horário"
  screen (`AdjustScheduleView.vue`). That screen never edits a version
  directly: every version gets an "Editar uma cópia" action that creates
  a new copy via a new `startDraft` store action (thin wrapper around the
  existing `duplicate`, FR-24) stamped `isDraft: true`
  (`ScheduleVersion.isDraft`, optional). The editable `ScheduleGrid` +
  Notes UI on that screen only ever render for
  `scheduleVersions.activeVersion` when `isDraft` is `true` — structurally
  guaranteeing a non-draft version can never be edited from this screen,
  not just by UI convention. A draft already in progress gets "Continuar
  editando" instead (no further copy) and a "Descartar rascunho" button.
  "Visualizar Horário" reverted to exactly its pre-E09, read-only shape.
- **Why**: user feedback, immediately after using the first version — two
  distinct problems: (1) editing mutated whatever the active version
  happened to be, in place, with no undo — genuinely risky, since FR-24's
  existing "Duplicar" only helps if the user remembers to use it *before*
  editing, and nothing nudged that; (2) "Visualizar Horário" is named and
  scoped (E08) as a browsing screen — bundling in the ability to change
  the schedule contradicted its own purpose, and E08/E09 were always
  separate epics with separate checkpoints ("browse" vs. "hand-tune") that
  got collapsed into one component for implementation convenience during
  E09, not because the spec called for it.
- **Affected epics/tasks**: E08 (`ViewSchedule.vue`), status `done` —
  reverted to its original shape, not a reopening of its checkpoint. E09,
  status `in-review` — UI relocated, `movePlacement`/`addNote`/etc. store
  actions and the underlying `verify`-based conflict flag are unchanged;
  see the epic file's Human Verification steps, updated to reference
  "Ajustar Horário" instead of "Visualizar Horário".
- **Related idea, not built here**: the user also proposed that after a
  manual edit, a solver-assisted re-solve could fix up the rest of the
  schedule while treating the manually-arranged placements as pinned —
  and suggested this screen eventually also host Teacher Absence & Repair
  (E14), since both are "modify a saved schedule, reconcile the
  consequences" operations. Recorded as a design sketch in E14's epic
  file ("Future consideration" section) rather than built now — it's a
  materially different, more general capability than E14's actual
  FR-35–37 scope (Repair only ever fills the specific slot(s) a Teacher
  Absence vacated, with another already-configured Teacher; it never runs
  the Refiner). Not a confirmed requirement yet — needs its own scoping
  pass before it becomes an FR.

## D-40 — Joint Sessions: separate placement array, not synthetic PlacedPeriods

- **Date**: 2026-09-21
- **Type**: Implementation-only
- **Spec refs**: FR-25–31, IMPL.md §4.1/§6
- **What changes**: a Joint Session occurrence is represented as its own
  `JointSessionPlacement { jointSessionId, weekday, timeSlotId }`, in a
  new `Schedule.jointSessionPlacements` array — not as one `PlacedPeriod`
  per participating Class with some synthetic Subject/Teacher. The
  Constructor's per-task search (`constructor.rs`) was generalized from a
  struct to a `Task` enum (`Assignment | JointSession`) so both share one
  backtracking loop; Joint Session tasks go first (they constrain several
  Classes/Teachers simultaneously — committing to them before an
  Assignment claims a needed slot avoids backtracking into a dead end
  found only much later). `verify`'s FR-29 check reuses
  `ClassDoubleBooked`/`TeacherDoubleBooked` (same violation from the
  user's point of view) rather than a new Violation variant, cross-checked
  against both ordinary placements and other Joint Session occurrences.
- **Why**: FR-30 is explicit that a Joint Session slot never satisfies any
  (Class, Subject) requirement — a `PlacedPeriod` always has exactly one
  Subject and one Teacher, and giving a synthetic Joint-Session Placement
  a real (or fake) `subjectId` would either wrongly count toward FR-8's
  occurrence-count check or require every FR-8-adjacent check to special-
  case "unless this is actually a Joint Session," multiplying the surface
  area for the same kind of subtle bug twice. A structurally separate
  array makes "only `placements` ever satisfies an Assignment" true by
  construction, not by convention every future check has to remember.
- **Found and fixed while verifying this** (not a spec deviation, a real
  bug): `TeacherScheduleGrid.vue`'s locally-built `entitiesSnapshot` never
  included `jointSessions`, so a Teacher who only staffs Joint Session
  Tracks (no ordinary Assignment) showed no schedule at all. See E10's
  epic file Notes for the full writeup and the matching gap this exposed
  in `ExportView.vue`/E12 (Joint Sessions don't render in the
  Human-Readable Export yet — not this epic's scope, flagged there).
- **Affected epics/tasks**: E10, all tasks `done`, epic `in-review`.

## D-41 — New epic E15: Excel round-trip, scoped to Saturno's own "Por Turma" export, always creating a new version

- **Date**: 2026-09-21
- **Type**: New scope (not traceable to a frozen FR/TR), plus a
  clarification of two spec statements that don't actually cover it.
- **Spec refs**: TR-12 (native format, JSON, "not meant for
  hand-editing"), FR.md's "Legacy spreadsheet import... out of scope for
  v1" line, FR-22/TR-13 (the existing `.xlsx` export this builds on),
  FR-24 (version-creation convention this follows).
- **What changes**: the "Por Turma" `.xlsx` (E12/`buildClassGridWorkbook`)
  now also carries a hidden `veryHidden` worksheet (`xlsxManifest.ts`)
  recording, for every visible data cell, exactly which
  (`classId`, `weekday`, `timeSlotId`) it is — written once per data cell
  as the grid is drawn (`xlsxExport.ts`'s `writeGrid` gained an optional
  `recordCell` callback), not re-derived at import time from the visible
  labels or from the current entities' layout. A new pure module,
  `xlsxImport.ts`, reads that manifest plus the current entities snapshot
  and reconstructs a `Schedule`: each cell's Teacher/Subject is resolved
  by exact name (reversing D-17's "(N)" same-name-Teacher suffix), a blank
  cell means "no placement," and any single unresolvable cell — an
  unknown name, a renamed/missing sheet, a missing manifest entirely —
  fails the whole import with every problem listed in one pt-BR error,
  never a partial or silently-wrong result. A new "Excel (.xlsx)" card on
  the "Dados" screen (`DataPortabilityView.vue`) wires this to a file
  input; on success it calls the existing `createFromSchedule` — the same
  action Generate uses — so import **always creates a new Schedule
  Version**, never overwrites one (confirmed with the user: repeated
  export→tweak→reimport cycles are expected to pile up in "Versões" rather
  than risk clobbering the wrong version). The per-Teacher `.xlsx` stays
  export-only — it's a derived view of the same data, so round-tripping it
  too would just be a second, redundant path to the same `Schedule`.
- **Why**: the user explicitly wants to work with Excel files directly
  (download, optionally hand-edit Teacher/Subject names or clear cells in
  Excel, upload back), citing `DEFERRED.md`'s "the exported sheet should
  match the layout of existing sheets more closely" and "import from an
  existing excel sheet" notes together. This is **not** the "legacy
  spreadsheet import" FR.md explicitly scoped out of v1 — that line is
  about bootstrapping a school's first configuration from an arbitrary,
  incomplete, real-world file like the ones in `sheets/`; this epic never
  creates or edits entities, only reconstructs a schedule against entities
  that already exist, from a file Saturno itself produced. It's also not a
  second "native format" competing with E11/TR-12 — TR-12's JSON stays the
  only full-state (entities + constraints + every version + notes) format;
  `.xlsx` round-trips exactly one Schedule Version's placements, nothing
  else, and still can't represent Joint Sessions (see Notes below).
  Position-based cell identity (rather than re-deriving the grid layout
  from current entities on import) was chosen because entities can drift
  between export and reimport (a Class renamed, a Time Slot resized) —
  trusting a manifest written at export time catches that drift as a clear
  error instead of silently misassigning a cell to the wrong Class or
  slot.
- **Affected epics/tasks**: new epic
  [E15](../epics/E15-excel-round-trip.md), `in-review` — all four tasks
  `done`, pending the epic's own Human Verification. Touches
  `xlsxExport.ts`/`xlsxExport.test.ts` (E12, `done`) only to add the
  manifest-recording callback — no change to that epic's own shipped
  behavior or checkpoint.

## D-42 — New epic INTERLUDE-2: Profiles (multi-Profile support), reconciling TR-6

- **Date**: 2026-09-22
- **Type**: New scope (not traceable to a frozen FR/TR); a naming
  exception; a clarification of TR-6.
- **Spec refs**: TR-6 ("data is scoped to a single browser profile on a
  single machine... no automatic sync between browsers, profiles, or
  devices").
- **What changes**: the app will support several independent **Profiles**
  in the same browser — each with its own complete entity configuration
  and Schedule Versions, switchable from a new always-visible header
  control, with a name and a color (from a small fixed palette) chosen by
  the user so the active one is obvious at a glance. A Profile can be
  created blank or duplicated from an existing one. TR-6's "single browser
  profile" language predates this and meant something different by
  "profile" (the browser's own profile concept, i.e. "no sync between
  Chrome profiles/devices") — that constraint is unaffected and still
  true; it just now applies per-Saturno-Profile rather than to one
  implicit dataset. Read TR-6 going forward as: data is scoped to a single
  browser profile on a single machine, *and*, within that, to whichever
  Saturno Profile is currently active — moving data between *machines*
  still only happens via the export/import file (TR-7), now scoped to the
  active Profile (see the open question on this in
  [INTERLUDE-2](../epics/INTERLUDE-2-profiles.md)'s Notes).
- **Why**: user's own words — they manage a school's teachers/subjects/
  timetables that "change completely" year to year (e.g. 2026 vs. 2027),
  and want to keep past years around, copy one forward as next year's
  starting point, and switch between them without either data getting
  mixed up or a "which one am I looking at" mistake — hence the explicit
  ask for a persistent, color-coded header control, not just a settings
  toggle.
- **Naming exception**: this is new user/system-visible capability, not a
  UI-only rework of already-shipped screens — by the rule set for E15
  (D-41) it would get a real `E<NN>` (next available: E16). Named
  `INTERLUDE-2` instead because the user asked for it by that exact name.
  Recorded here, and in [BOARD.md](../BOARD.md)'s sequencing notes, so a
  future reader doesn't mistake the inconsistency for a mistake.
- **Affected epics/tasks**: new epic
  [INTERLUDE-2](../epics/INTERLUDE-2-profiles.md), `new` — no tasks
  started yet. Once T2 (profile-scoped persistence) lands, it touches the
  persistence layer (`db.ts`/`persistencePlugin.ts`) underneath every
  other epic's `entities`/`scheduleVersions` reads and writes, though none
  of their own code should need to change (see that epic's Notes).

## D-43 — `consecutivePeriods` is a per-Assignment ceiling, not a required grouping

- **Date**: 2026-09-22
- **Type**: Correctness fix / clarification of FR-10 (behavior, not just wording — see below).
- **Spec refs**: FR-10 ("double/triple period flag, hard 3-period ceiling"), IMPL.md §5.1 (Constructor task decomposition).
- **What changes**: `Assignment.consecutivePeriods` now means "a same-
  (Class,Subject) run is allowed to get up to this long," never "must be
  grouped into blocks of this size." Concretely:
  - `solver/src/constructor.rs`'s `build_tasks` no longer decomposes
    `weeklyOccurrences` into fixed `consecutivePeriods`-sized blocks (with
    a remainder as its own smaller block) — every occurrence is now an
    independent single-period task. Whether two of them end up adjacent is
    purely a consequence of where the search finds room, not something
    pre-committed to.
  - The placement-time ceiling check (`candidates_for_task` and the dead
    -end classifier `classify_reason`) now rejects a candidate that would
    make a run exceed `assignment.consecutive_periods`, not the flat
    global `MAX_CONSECUTIVE_PERIODS` (3) — so a value of 1 or 2 is now a
    real, tighter cap than before, not just a hint to the (removed) block
    -decomposition.
  - `solver/src/verify.rs`'s `check_runs` — and the `ConsecutiveBlockBroken`
    `Violation` it used to also emit ("expected N blocks of size M, found
    fewer") — is gone entirely; there is no "not grouped enough" check
    anymore. `ConsecutiveCeilingExceeded` now compares a run's length
    against the matching Assignment's own `consecutivePeriods` (falling
    back to the absolute `MAX_CONSECUTIVE_PERIODS` only if no Assignment
    matches at all — a defensive case for arbitrary/hand-edited input).
  - `app/src/wasm/types.ts`'s `Violation` union and
    `entities/conflictFlags.ts` had the now-nonexistent
    `'consecutiveBlockBroken'` case removed to match.
  - `AssignmentsConfig.vue`'s dropdown labels changed from "Nenhum /
    Dupla / Tripla" to "Nenhum (nunca consecutivos) / Até 2 (dupla
    permitida) / Até 3 (dupla ou tripla permitida)" — the field label
    itself is now "Períodos consecutivos **permitidos**."
- **Why**: user's own words — "it does not mean that there should be two
  consecutive ones. It means that there can be up to two consecutive ones
  ... if the classes are all spread out, that is fine, but if they need to
  be 2 consecutive or three, they are allowed based on this dropdown. They
  are a fence, not a constraint." The old behavior actively worked against
  this in two ways: (1) the Constructor could make a genuinely feasible
  school (fully spread out) come back infeasible, purely because it
  insisted on building fixed-size blocks instead of exploring a spread
  -out placement; (2) because the actual enforced ceiling was always the
  flat global 3 rather than the Assignment's own value, a school could set
  "Até 2" and still get a real 3-in-a-row block in the generated schedule
  without any violation ever surfacing — the setting looked honored but
  wasn't. "Quality" preferences (e.g. *preferring* a double when there's
  room, not just allowing one) are deliberately left to E13's Scorer/
  Refiner per the Constructor's own existing "feasibility-first" framing —
  not added here.
- **Real-world consequence, found during verification**: reran the actual
  exported school data (`export-2026-09-21.json`) through "Gerar Horário"
  after this change and got a genuine (new) infeasibility: Carlos (6º Ano
  A, Matemática 3, 5 weeklyOccurrences, `consecutivePeriods` 2, same-day
  repetition off) is only available Tue/Wed — 2 days × a real ceiling of 2
  maxes out at 4, short of the 5 needed. The old code silently used a run
  of 3 to make this fit despite the Assignment being configured for "Até
  2," which is exactly the kind of silent mismatch this fix closes — not a
  regression, but this real data will need `consecutivePeriods` raised to
  3 for that one Assignment (or occurrences reduced, or Carlos's
  availability widened) before it generates again. Left as-is, not
  "fixed" in the user's data — that's a configuration call for them, not
  an implementation one.
- **Tests**: `solver/src/lib.rs` — replaced
  `double_period_assignments_are_placed_as_a_genuinely_consecutive_block`
  (asserted an outcome the old code never actually guaranteed beyond
  greedy candidate-ordering happening to try the same day first) with
  three tests that pin down the real contract: a fully spread-out schedule
  passing `verify` even at `consecutivePeriods` 3; a run of 3 flagged as
  `ConsecutiveCeilingExceeded` when the Assignment's own ceiling is 2 (even
  though 3 is within the absolute FR-10 max — proving the ceiling is now
  per-Assignment); and a Constructor-level feasibility test where a
  Teacher never has two adjacent free periods on any day, `consecutivePeriods`
  2, `weeklyOccurrences` 2 — infeasible under the old forced-block
  behavior, feasible now. Updated `never_exceeds_three_consecutive_same_subject_periods`
  (was exercising `consecutivePeriods` 1, which now caps runs at 1 and so
  no longer exercised the absolute-3 ceiling it was named for — changed to
  3) and `same_day_blocks_of_one_assignment_may_merge_when_repetition_is_disallowed`
  (was `consecutivePeriods` 2 with 5 occurrences across 2 available days —
  genuinely infeasible under the corrected ceiling, same reasoning as the
  Carlos case above; raised to 3, which is what the regression it guards
  against — merging into one run rather than being wrongly refused — still
  needs to exercise).
- **Affected epics/tasks**: E06 (`solver/src/constructor.rs`,
  `verify.rs`), E05 (`entities/assignment.ts`, `AssignmentsConfig.vue`),
  E09 (`conflictFlags.ts`, `wasm/types.ts`) — all `done`; correctness/
  semantics fixes to already-shipped modules, not a reopening of any of
  their checkpoints.

## D-44 — Subjects gain the same "Ordenar por nome (A-Z)" one-off sort as Teachers

- **Date**: 2026-09-22
- **Type**: Implementation-only (retrofit, mirrors an existing pattern).
- **Spec refs**: FR-7. Directly extends D-26.
- **What changes**: `entities.ts` gains `sortSubjectsByName()`, identical
  in shape to D-26's existing `sortTeachersByName()` — a one-off
  alphabetical bulk-reorder of the `subjects` array (`localeCompare`,
  stable sort), not a standing invariant; `moveSubject`'s existing ▲/▼
  buttons still freely rearrange the result afterward. `SubjectsConfig.vue`
  gets the same "Ordenar por nome (A-Z)" button `TeachersConfig.vue`
  already had, same placement/gating (`v-if="length > 1"`).
- **Why**: user-requested — Subjects had no equivalent to the sort button
  Teachers already got in D-26. No separate "make dropdowns reflect it"
  work was needed: D-26 already established that every list/dropdown
  renders directly off the store's `teachers`/`subjects` array order (no
  separate display-order layer), so sorting the array is automatically
  everywhere the moment it happens — confirmed against the real exported
  school data (Atribuições' Subject dropdown picked up the new order
  immediately after clicking the button, no other code touched).
- **Affected epics/tasks**: E03 (`SubjectsConfig.vue`), `done` — a
  retrofit, not a reopening of its checkpoint.

## D-45 — Conflict tooltip: a real bulleted `<ul>`, teleported to escape WeekGrid's scroll clipping

- **Date**: 2026-09-22
- **Type**: Implementation-only.
- **Spec refs**: FR-18 (live conflict flag), IMPL.md's `WeekGrid.vue`.
- **What changes**: `ScheduleGrid.vue`'s conflict-flagged cell (`.pill.conflict`,
  FR-18) no longer uses a native `title="msg1 msg2"` tooltip — every
  message ran together as one paragraph, with no way to get real bullet
  points out of a `title` attribute. It's now a genuine `<ul><li>` list,
  shown on `@mouseenter`/hidden on `@mouseleave` (not CSS `:hover`) and
  rendered via `<Teleport to="body">`, positioned with inline `top`/`left`
  computed from the hovered pill's own `getBoundingClientRect()`. The
  Teleport turned out to be load-bearing, not just tidiness: a first pass
  using plain `position: absolute` + CSS `:hover` was visually clipped —
  `WeekGrid.vue`'s scroll wrapper sets `overflow-x: auto`, which per the
  CSS spec implicitly computes `overflow-y: auto` too, so any popover
  taller than the current row got cut off at the wrapper's edge the moment
  it grew past one line. Confirmed both broken (clipped, via a full-page
  screenshot) and fixed (unclipped, `getBoundingClientRect()` matching the
  teleported element's actual on-screen box) against a hand-built two
  -violation fixture in a headless-Chromium session.
- **Why**: user-requested — multiple stacked Violation messages on one
  cell read as a run-on paragraph in the native tooltip; asked for bullet
  points, native if possible, a custom component if not. Concluded native
  couldn't do it reliably (no cross-browser-guaranteed way to force line
  breaks + bullet glyphs from a `title` attribute, and no way to verify it
  at all — native OS tooltips aren't part of the page's render tree, so
  nothing in this project's screenshot-based verification convention can
  actually confirm how they'd render) and built the custom list instead.
- **Affected epics/tasks**: E09 (`ScheduleGrid.vue`), `done` — a retrofit,
  not a reopening of its checkpoint.

## D-46 — "Bloquear/Liberar dia" spans every Segment, not just the clicked one

- **Date**: 2026-09-22
- **Type**: Correctness fix.
- **Spec refs**: FR-3 (Teacher availability). Directly affects D-29's
  per-Segment availability-grid grouping.
- **What changes**: `TeachersConfig.vue`'s "Bloquear dia"/"Liberar dia"
  button (one per weekday, per Segment grid, D-29) now toggles that
  weekday across *every* Segment the Teacher has an availability grid for,
  not only whichever Segment's grid the button was clicked in.
  `isDayFullyUnavailable`/`toggleDay` were re-scoped from taking one
  group's `rows` to iterating `availabilityGroups.value` (every group);
  the button's own "already blocked?" state is computed the same
  all-groups way, so a Teacher who teaches in two Segments sees both
  grids' buttons flip together and stay in sync.
- **Why**: user-requested — a Teacher's day off is a real fact about the
  Teacher, not about one Segment; leaving the other Segment's periods
  still marked available after "blocking the day" left a real gap a user
  could easily miss (Teacher shows as free for the other Segment on a day
  they said they weren't). Confirmed against the real exported school data
  (Fernando, who teaches Geografia 2 in both Ensino Médio and Ensino
  Fundamental): clicking "Bloquear dia" for Monday in the Ensino Médio
  grid also blocked Monday in the Ensino Fundamental grid (button flipped
  to "Liberar dia" in both), Tuesday untouched in either, and toggling
  back freed both.
- **Affected epics/tasks**: E04 (`TeachersConfig.vue`), `done` — a
  correctness fix to an already-shipped screen, not a reopening of its
  checkpoint.

## D-47 — Segments gain manual reorder + "Ordenar por nome (A-Z)", same as Teachers/Subjects

- **Date**: 2026-09-22
- **Type**: Implementation-only (retrofit, mirrors an existing pattern).
- **Spec refs**: FR-6. Directly extends D-26/D-44.
- **What changes**: `entities.ts` gains `moveSegment(id, direction)`
  (`moveItem`, same helper D-26's `moveSubject`/`moveTeacher` already use)
  and `sortSegmentsByName()` (one-off alphabetical bulk sort, mirrors
  D-44's `sortSubjectsByName`) — Segments previously had neither, only
  insertion order with no way to change it. `SegmentsConfig.vue` gets the
  same ▲/▼ buttons and "Ordenar por nome (A-Z)" button the Subjects/
  Teachers screens already have, identical placement/gating.
- **Why**: user-requested, "same side effects as teachers and subjects" —
  Segment display order (Exportar's sheet order, any Segment-grouped
  dropdown) had no user-facing control at all until now.
- **Affected epics/tasks**: E02 (`SegmentsConfig.vue`), `done` — a
  retrofit, not a reopening of its checkpoint.

## D-48 — "Atribuições cadastradas" table sorted by Disciplina, tracking the Subjects list's own order

- **Date**: 2026-09-22
- **Type**: Implementation-only.
- **Spec refs**: FR-9. Builds on D-26/D-44's Subject ordering.
- **What changes**: `AssignmentsConfig.vue`'s `filteredAssignments` now
  sorts by each row's Subject's position in `store.subjects` (a stable
  sort, so rows sharing a Subject keep their existing relative order) —
  previously unsorted (whatever order Assignments happened to be created
  in). Not a fresh independent alphabetical sort: it tracks whatever order
  the Subjects list is already in, so re-sorting or manually reordering
  Subjects (D-26/D-44) re-groups this table too, without a second,
  possibly-conflicting ordering concept.
- **Why**: user-requested. Confirmed against the real exported school data
  that the table was already grouped by Disciplina following the existing
  custom Subject order, and re-sorting Subjects A-Z immediately re
  -grouped the table to match (Artes, Biologia, Ciências, Ed Física, ...).
- **Affected epics/tasks**: E05 (`AssignmentsConfig.vue`), `done` — a
  retrofit, not a reopening of its checkpoint.

## D-49 — Notes footnotes/markers in the Human-Readable Export: scoped and numbered per grid, not globally

- **Date**: 2026-09-22
- **Type**: Clarification
- **Spec refs**: FR-19, IMPL.md §9
- **What changes**: IMPL.md §9 says notes render as "a numbered footnote
  list beneath the grid" with a "reference marker" on a slot Note's cell,
  but doesn't say how numbering/scope work across an export that's
  actually several grids (one per Segment for Per-Turma, one per
  Teacher×Segment for Por Professor) sharing one Schedule Version's flat
  `notes` array. Implemented as: each `ClassGridExport`/`TeacherGridExport`
  gets its own `footnotes` list, numbered 1..N independently per grid —
  every whole-schedule Note (no `slot`) appears on every grid, plus every
  slot Note whose slot is actually relevant to that specific grid (its
  Class is a column of this Segment's grid; or, for a Teacher's grid,
  the Note's slot matches that exact Teacher's own placement — a Note on
  a different Teacher's period in the same Segment, or on a Class this
  Teacher doesn't teach, doesn't surface there). A slot Note on an empty
  slot (no placement — E09/`ScheduleGrid.vue` allows this) still renders:
  the cell shows just the reference marker, `lines: []`, rather than being
  dropped as if it were a `null` cell — but such a Note can never appear on
  a Teacher grid, since there's no Teacher to attach it to at an empty
  slot.
- **Why**: matches the real sample sheet's per-page "Observação N"
  convention (`sheets/HorárioEF_24.08.2026_T1.xlsx`: label row + text row,
  inspected directly) better than one global numbering that would jump
  unpredictably across unrelated Segment/Teacher pages; a global list would
  also force every page to either show irrelevant footnotes or renumber
  around gaps.
- **Affected epics/tasks**: E12-T4.

## D-50 — `score`'s FR-15 metrics: gap-minutes and per-(Class,Subject) daily-count variance, lower-is-better

- **Date**: 2026-09-23
- **Type**: Implementation-only
- **Spec refs**: FR-15, TR-9, IMPL.md §4.2, §10
- **What changes**: IMPL.md §4.2 names `score`'s return shape as "a
  breakdown, not just one number" with example fields
  (`teacherGapScore`, `subjectDistributionScore`, `total`) but leaves the
  actual formula, units, and higher/lower-is-better direction open — §10
  explicitly flags Scorer weights as unresolved, "assumes fixed sensible
  defaults for MVP." Implemented as (`solver/src/score.rs`):
  - `teacherGapPenalty`: summed idle minutes across every Teacher's day —
    real-clock-time span from that day's first placement's start to its
    last placement's end, minus the minutes actually occupied, summed
    over every (Teacher, weekday). Resolved via `verify.rs`'s own
    `resolve`/`Resolved` (now `pub(crate)`) so gaps use the exact same
    cross-Segment real-clock-time resolution as the existing
    double-booking checks (D-01), not a second, possibly-diverging
    implementation.
  - `subjectDistributionPenalty`: for every (Class, Subject) with an
    Assignment, the population variance of its placements' per-weekday
    counts against a perfectly even spread, summed across every
    (Class, Subject). Zero when a Subject's occurrences are spread as
    evenly as its own weekly count allows.
  - `total = teacherGapPenalty * 1.0 + subjectDistributionPenalty * 10.0`
    — TR-9 frames soft objectives as "weighted penalties," so the
    convention here is **lower is better** throughout (including
    `total`), not the "higher is better" a bare word "score" might
    suggest. The 10x weight on distribution is a magnitude-matching
    choice (a real week produces low-hundreds of gap-minutes but only a
    handful of variance points), not a statement that even distribution
    matters 10x more than minimizing gaps — reasoned about, not measured
    against real school preference, so it may need revisiting once E13's
    Refiner (T2) produces real ranked candidates to eyeball.
- **Why**: a concrete, testable formula was needed to build anything;
  IMPL.md §10 anticipated this ("worth tuning once there's a real build
  to profile") rather than treating it as settled.
- **Affected epics/tasks**: E13-T1.

## D-51 — Refiner move set, Candidate-emission rule, and cooling schedule

- **Date**: 2026-09-23
- **Type**: Implementation-only
- **Spec refs**: FR-15, IMPL.md §5.1, §10
- **What changes**: IMPL.md §5.1 names the Refiner's shape ("perturbs it
  (e.g. swap two assignments, reassign a slot)... accepting or rejecting
  moves based on `score`... simulated-annealing-style... Each
  locally-optimal or improved state encountered is emitted as a
  `Candidate`") but leaves the exact move set, emission trigger, and
  cooling curve open — §10 explicitly flags "Refiner acceptance strategy"
  as unresolved. Implemented (`solver/src/refiner.rs`):
  - **Move set**: exactly IMPL.md's two named examples, both scoped to a
    single randomly-picked Class's own `placements` — "Move" (relocate
    one placement to a currently-empty (weekday, TimeSlot) for that same
    Class) and "Swap" (trade two of that Class's placements' slots).
    Never cross-class, never touches `jointSessionPlacements` (FR-25) —
    a Joint Session move would need to reschedule every participating
    Class and Track Teacher at once, a materially bigger and differently-
    shaped operation IMPL.md's Refiner section never mentions.
  - **Feasibility**: every proposal is checked with the real `verify()`
    (not re-derived) and simply discarded — counted as one "spent"
    iteration either way — if infeasible; no attempt to only generate
    moves that are provably safe in advance.
  - **Emission rule**: a `Candidate` is pushed exactly when an accepted
    move sets a new best-ever `score().total` for the run — not on every
    accepted move (an SA-accepted worse move is a mid-walk state, not a
    result worth surfacing) and not via a separate "is this a local
    optimum" neighborhood scan (expensive, open-ended to define
    precisely, and unnecessary: every emitted Candidate is already
    at-least-as-good as everything found earlier in the run, which is
    what "locally optimal or improved" is really protecting against
    showing the user a same-or-worse result).
  - **Cooling**: `refine(input, initial, rng, iterations)` takes a plain
    iteration count, not a time budget — E13-T4 (progress
    streaming/cancellation) is the task that turns this into real
    elapsed-time slicing; `refine` itself only needs *some* notion of
    "how far through the run," so it linearly cools
    `initial_temperature * (1 - i/(iterations-1))`.
    `initial_temperature = max(startingScore.total * 0.2, 1.0)` — scaled
    off the starting Schedule's own score (its units aren't a fixed
    range) rather than a constant, with a floor so an already-perfect
    (`total == 0`) starting point still gets some early exploration
    instead of degenerating to pure greedy descent from iteration 0.
  - **RNG**: `rand_chacha::ChaCha8Rng`, always explicitly seeded
    (`default-features = false` on both `rand`/`rand_chacha` — no
    `getrandom`/OS-entropy dependency, since a seed is always passed in;
    IMPL.md §5.2 needs one distinct seed per Worker anyway, and this
    keeps `refine` itself fully deterministic and unit-testable).
- **Why**: IMPL.md §10 anticipated the acceptance/emission strategy would
  need a concrete first choice before Refiner work could start at all
  ("Tabu search or a genetic algorithm... worth a spike... if someone has
  a strong prior") — none was raised, so the originally-proposed
  simulated-annealing shape was implemented as literally as the spec text
  allows, with the open points above resolved as narrowly as possible
  rather than guessing at unstated intent. All of it (weights, cooling
  rate, move set) is explicitly flagged as tunable once E13-T3's Worker
  pool produces real ranked runs to eyeball, same as D-50's score weights.
- **Affected epics/tasks**: E13-T2.

## D-52 — `generateDeep` (Worker pool's per-Worker unit) and the pool's own shape

- **Date**: 2026-09-23
- **Type**: Implementation-only
- **Spec refs**: IMPL.md §3, §4.3, §5.2, §10
- **What changes**:
  - **`generateDeep(input, seed, iterations) -> GenerateDeepResult`**
    (`solver/src/lib.rs`): a new wasm export composing
    `constructor::generate_quick` (Constructor) then, if feasible,
    `refiner::refine` (Refiner) for a fixed `iterations` count from a
    `u32` seed — the minimal thing a pool Worker can call today. Same
    precedent as `generateQuick`/D-19: provisional, not the real
    `generate(input, timeBudgetMs)` IMPL.md §4.3 describes (no time
    budget, no progress streaming) — E13-T4 will very likely rework the
    calling convention into slice-yielding messages without needing to
    change `refiner::refine` or the Constructor. `seed` is `u32` rather
    than IMPL.md's implicit "RNG seed" (no size specified) — a `u64`
    would need JS `BigInt` at the wasm-bindgen boundary for no real
    benefit (~4.3 billion distinct seeds is far more than a ≤8-Worker
    pool ever needs).
  - **The pool doesn't run the Constructor once and share it** — every
    Worker independently re-runs the (cheap, TR-10-scale "a few seconds")
    Constructor phase too, exactly as IMPL.md §3's architecture diagram
    shows ("WASM module instance... `generate(...)`" per Worker, not "the
    coordinator runs Constructor once and distributes it"). Since the
    Constructor has no randomness, every Worker agrees on the same
    starting point regardless — this is a deliberate simplicity/uniformity
    choice (every Worker does the same self-contained job, coordinator
    stays dumb), not an oversight; it also means an infeasible `input` is
    reported identically by every Worker, so the pool coordinator
    (`app/src/solver/deepSearchPool.ts`) just returns the first one it
    sees rather than reconciling N reports.
  - **Pool size cap**: 6 (`POOL_SIZE_CAP`), the lower end of IMPL.md §5.2's
    own "e.g. 6-8" — explicitly flagged there (and here) as a guess
    needing empirical tuning on real hardware, not a measured number.
  - **Per-Worker RNG seed**: `crypto.getRandomValues` — genuinely random
    per real run (not reproducible run-to-run at the app level; that
    determinism guarantee belongs to `refiner::refine`'s own Rust tests
    given a fixed seed, D-51).
  - **Pool lifecycle**: spawned fresh and fully torn down
    (`Worker.terminate()`) within one `runDeepSearchPool` call — no
    warm/reused pool across separate deep-search runs. Simplest correct
    thing for this task; E13-T4 (once progress/cancellation exist) may
    find a longer-lived pool worth it, but nothing today needs one.
  - **Merging/ranking stays out of scope here**: `runDeepSearchPool`
    returns `candidatesByWorker: Candidate[][]`, unmerged and unranked —
    E13-T5 (dedup) and T6 (the actual "Coordinator: merge/rank... hand the
    ranked list to the UI") own that, deliberately not duplicated here.
- **Why**: IMPL.md leaves the pool-size cap, per-Worker seeding mechanism,
  and pool lifecycle open (§10 names the cap explicitly); the Constructor-
  redundancy choice and the merge/rank scope boundary follow directly from
  reading IMPL.md §3's diagram and the epic's own T3/T5/T6 task split
  literally rather than optimizing or scope-creeping ahead of them.
- **Affected epics/tasks**: E13-T3.

## D-53 — Deep search is clock-free in Rust: a resumable `RefineSession`/`DeepSearchSession`, elapsed time and slice sizing are the Worker's job

- **Date**: 2026-09-23
- **Type**: Implementation-only
- **Spec refs**: IMPL.md §4.3, §5.1, §5.3
- **What changes**: replaces E13-T2's one-shot `refine(iterations)` free
  function and E13-T3's one-shot `generateDeep` wasm export (D-52) with a
  resumable design:
  - **`solver/src/refiner.rs`**: `refine` becomes `RefineSession`, a struct
    holding the RNG/current-Schedule/best-so-far state across repeated
    `run_slice(elapsed_ms, iterations)` calls. Cooling is now driven by
    `elapsed_ms / time_budget_ms` (a real fraction of the actual time
    budget, matching FR-32) rather than an iteration-count fraction known
    up front — a genuine, necessary rework, not just a rename: a real
    time-boxed run doesn't know its total iteration count in advance, so
    the old per-call cooling curve couldn't carry over.
  - **Deliberately never reads a clock itself**: both `elapsed_ms` (how
    much real time the caller measured as spent so far) and `iterations`
    (how many proposal attempts to make this call) are plain arguments.
    Considered reading `Instant`/`web-time` internally and having
    `RefineSession` own its own timer — rejected because it would make the
    session non-deterministic and hard to unit-test (two "same seed" runs
    could attempt different numbers of iterations depending on real
    system timing jitter, breaking exactly the kind of determinism test
    D-51 relies on). Keeping Rust clock-free means `RefineSession` stays
    exactly as pure/TR-11-testable as the free function it replaced; all
    wall-clock measurement and slice-pacing moved to
    `solver.worker.ts`'s own driving loop.
  - **`solver/src/lib.rs`**: a new `DeepSearchSession` wasm-exported class
    (constructor runs the Constructor once; `runSlice` mirrors
    `RefineSession::run_slice`) replaces `generateDeep`. An `Infeasible`
    session (the Constructor itself failed) reports the same
    `InfeasibilityReport` on every `runSlice` call, cheaply, without
    touching the Refiner.
  - **`solver.worker.ts`**: a new `startDeepSearch`/`cancelDeepSearch`
    message pair replaces `generateDeep`. `startDeepSearch` drives an
    autonomous slice loop — measuring real elapsed time via
    `performance.now()`, adaptively sizing each slice's `iterations`
    toward a `SLICE_TARGET_MS` (100ms) target based on how long the
    *previous* slice actually took (since how many iterations take ~100ms
    is hardware-dependent and can't be hardcoded), `postMessage`-ing a
    `deepSearchProgress` message after every slice, and yielding to the
    event loop (`setTimeout(…, 0)`, a real macrotask boundary — a
    microtask wouldn't reliably let a pending `postMessage` be processed
    first) so a `cancelDeepSearch` message can land between slices. On
    cancellation, the Worker posts one final synthetic `done: true`
    message on the cancelled run's own behalf, since `run_slice` itself
    has no notion of cancellation — an earlier draft skipped this and the
    pool hung forever waiting for a "done" that would never otherwise
    arrive.
  - **`deepSearchPool.ts`**: `runDeepSearchPool` (T3's one-shot function)
    is replaced by `startDeepSearchPool(input, timeBudgetMs, onProgress)`,
    returning `{ cancel, result }`. Aggregates every Worker's streamed
    progress into one FR-34-shaped view (`elapsedMs`, `bestTotal` across
    the whole pool, `candidatesFound`, `done`); `cancel()` broadcasts
    `cancelDeepSearch` to every Worker. `result` resolves once every
    Worker reports done, or immediately (cancelling the rest) on the
    first `Infeasible`/genuine error.
- **Why**: IMPL.md §5.3 is explicit that a real deep-search run must yield
  control every ~100ms and support cancellation "checked at the top of
  the next slice" — T3's one-shot `generateDeep` (itself explicitly
  provisional, D-52) structurally couldn't do either. The clock-free
  Rust design specifically avoids trading away T2's determinism/
  testability guarantees to get there.
- **Bug caught building this** (worth recording, not just fixing): the
  new `SliceResult` enum in `lib.rs` initially had
  `#[serde(rename_all = "camelCase")]` on the enum only, not each
  variant — exactly the `Violation`-serialization bug `model.rs` already
  carries a regression test for (E09). It silently sent
  `new_candidates`/`best_total` instead of `newCandidates`/`bestTotal`;
  the JS side read `undefined` for both, and `deepSearchPool.ts`'s
  `...sliceResult.newCandidates` spread threw *inside* a Worker's
  `onmessage` handler — an uncaught exception there doesn't reject any
  Promise, so the whole pool just hung forever with no visible error.
  Fixed by adding the attribute per-variant (matching `Violation`'s
  pattern exactly) and adding
  `slice_result_progress_fields_serialize_as_camel_case`
  (`solver/src/lib.rs`) as a second, permanent regression test for this
  exact class of mistake.
- **Affected epics/tasks**: E13-T3 (supersedes `generateDeep`, most of
  D-52 still stands: pool size/seeding/lifecycle/merge-scope), E13-T4.

*(entries above are the most recent)*
