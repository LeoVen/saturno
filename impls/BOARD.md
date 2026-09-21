# Epic Board

Single source of truth for **epic-level** status. Task-level status lives
inside each epic's own file under `epics/`. See `PROCESS.md` for how to use
this file and how status values work.

Epic status is derived from its tasks (§6/§7 of PROCESS.md): `new` until a
task starts, `in-progress` once one has, `in-review` once all tasks are done
but Human Verification hasn't happened yet, `done` once it has.

## Cross-cutting requirements

These apply continuously, across every epic below, rather than as a task in
each one — called out once here instead of repeated 14 times:

- **FR-1** (pt-BR only) — every new label, message, and export produced by
  any epic is in Brazilian Portuguese. No i18n framework is planned (single
  supported locale) — see E01's notes.
- **TR-5** (IndexedDB persistence) — any epic introducing a new entity or
  store wires it into the existing hydrate-on-load / write-through pattern
  established in E01, not a one-off persistence mechanism.
- **TR-11** (pure, testable solver logic) — every epic that adds or extends
  a solver-adjacent pure function (validation in E05, `verify`/`generate` in
  E06, E10, E13, `repair` in E14) adds unit tests alongside it, using the
  harness established in E01.
- **TR-14/TR-15** (browser targets, no phone layout) — a standing constraint
  on every UI epic, not a per-epic checkbox.

## Epics

| ID | Title | Status | Checkpoint (human-testable) | File |
|---|---|---|---|---|
| E01 | Project Scaffolding & Deployment Pipeline | done | App deploys to GitHub Pages and loads | [epics/E01-scaffolding-deployment.md](epics/E01-scaffolding-deployment.md) |
| E02 | Segments, Time Slots & Breaks | done | Configure a Segment's periods/breaks, persists | [epics/E02-segments-time-slots-breaks.md](epics/E02-segments-time-slots-breaks.md) |
| E03 | Grades, Classes & Subjects | done | Configure grades/classes/subjects, persists | [epics/E03-grades-classes-subjects.md](epics/E03-grades-classes-subjects.md) |
| E04 | Teachers & Availability | done | Create teachers, set availability grid, persists | [epics/E04-teachers-availability.md](epics/E04-teachers-availability.md) |
| E05 | Requirements, Assignments & Validation | done | Weekly loads + teacher assignments configured; bad config warns | [epics/E05-requirements-assignments-validation.md](epics/E05-requirements-assignments-validation.md) |
| INTERLUDE-1 | UI/UX Pass | done | Sidebar nav, 24h time input, calendar-style grids, no implementation-detail leaks | [epics/INTERLUDE-1-ui-ux-pass.md](epics/INTERLUDE-1-ui-ux-pass.md) |
| E06 | Solver Core: Quick Generation | done | Generate click → a valid schedule, or a specific infeasibility reason | [epics/E06-solver-core-quick-generation.md](epics/E06-solver-core-quick-generation.md) |
| E07 | Schedule Versions | done | Multiple named versions, switch/duplicate | [epics/E07-schedule-versions.md](epics/E07-schedule-versions.md) |
| E08 | Views: Per-Class & Per-Teacher | done | Browse the saved schedule both ways | [epics/E08-views-per-class-per-teacher.md](epics/E08-views-per-class-per-teacher.md) |
| E09 | Manual Editing, Conflicts & Notes | in-review | Move an assignment, see conflicts flagged, attach a note | [epics/E09-manual-editing-conflicts-notes.md](epics/E09-manual-editing-conflicts-notes.md) |
| E10 | Joint Sessions | new | Shared multi-class session schedules correctly, shown distinctly | [epics/E10-joint-sessions.md](epics/E10-joint-sessions.md) |
| E11 | Native Data Portability | in-review | Export full state, import on a fresh profile, restored | [epics/E11-native-data-portability.md](epics/E11-native-data-portability.md) |
| E12 | Human-Readable Export | in-progress | Print view and .xlsx match the school's grid format | [epics/E12-human-readable-export.md](epics/E12-human-readable-export.md) |
| E13 | Deep Search | new | Time-boxed run, live progress, cancel, ranked candidates to choose from | [epics/E13-deep-search.md](epics/E13-deep-search.md) |
| E14 | Teacher Absence & Repair | new | Mark absence → repair fills/reports vacated slots | [epics/E14-teacher-absence-repair.md](epics/E14-teacher-absence-repair.md) |

## Sequencing notes

- **E06 before E07**: Quick Generation must exist before there's a schedule
  worth versioning.
- **E07 before E08/E09**: Notes (FR-19) are explicitly scoped to a Schedule
  Version (FR-24), and Manual Editing (FR-17) operates on a saved schedule —
  both need Schedule Versions to exist first. This was flagged and corrected
  during initial epic planning; see git history on this file if the reasoning
  is ever unclear.
- **E10 (Joint Sessions) deferred**: confirmed with the user — build core
  single-class scheduling all the way through (config → generate → version →
  view → edit) before layering in Joint Sessions' cross-cutting config/solver/
  view extensions (FR-25–31).
- **FR-13 (validation) has no standalone epic**: confirmed with the user —
  folded into E05 (the checks) and E06 (the pre-generation gate).
- **INTERLUDE-1 before E06**: user-requested UI/UX rework of E02–E05's
  screens, inserted before solver work starts rather than after all 14
  epics — see [D-14](DECISIONS.md). Not FR/TR-traceable, hence the
  `INTERLUDE-N` naming instead of `E<NN>`.
