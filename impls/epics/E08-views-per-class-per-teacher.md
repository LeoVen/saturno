# E08 — Views: Per-Class & Per-Teacher

**Status**: done

## Goal

Let the user actually look at a saved Schedule Version — as a weekly grid
per Class, and as a weekly grid per Teacher.

## Spec references

- **FR-20** — Per-Class view, each period shows Subject + Teacher.
- **FR-21** — Per-Teacher view, each period shows Class + Subject, across every class taught.
- **TR-19** — reached via in-app state/tabs, no URL router.

## Human verification

1. Open the active Schedule Version's Per-Class view for a specific Class;
   confirm every occupied period shows both Subject and Teacher.
2. Open the Per-Teacher view for a specific Teacher; confirm their full week
   across every Class they teach is visible, each period showing Class and
   Subject.
3. Switch between views without a page reload/URL change (TR-19).

## Tasks

| ID | Task | Status |
|---|---|---|
| E08-T1 | Per-Class weekly grid view component (FR-20) | done |
| E08-T2 | Per-Teacher weekly grid view component (FR-21) | done |
| E08-T3 | In-app navigation between views/entities (state-driven, no router per TR-19) | done |

## Decisions

- See [D-24](../DECISIONS.md) — the Per-Teacher grid's rows are the same
  cross-Segment union of Time Slots as D-15's Teacher Availability grid,
  not one Segment's own period list. (Superseded by D-29 below, then
  narrowed back by D-37 for this screen specifically — see the lineage.)
- See [D-29](../DECISIONS.md) — supersedes D-24/D-15's flat-merge design:
  one grid per Segment instead, for both this view and the Teacher
  Availability grid.
- See [D-37](../DECISIONS.md) — narrows D-29 for this screen only (the
  Teacher Availability grid on Professores is unaffected): one merged
  grid per Teacher, with real idle time between Segments shown as a
  "Janela" (Gap, FR-15) cell.

## Notes

- **Bug found and fixed (2026-09-21)**: `TeacherScheduleGrid.vue`'s cell
  lookup keyed placements by `weekday:start-end` only. When D-29 switched
  this view from one merged cross-Segment grid to one grid per Segment, two
  Segments whose Time Slots happen to share an identical clock time (e.g.
  both starting 07:00–07:50) could show a placement from one Segment's
  grid leaking into the other Segment's grid at the matching row — visible
  to a user as "the same Class showing under both Segments." Verified
  against real exported school data (a Teacher spanning Ensino
  Fundamental and Ensino Medio, whose Time Slots overlap at several
  points in the day): 120 leaked cells across the schedule before the fix,
  0 after. Fixed by scoping the lookup key by `segmentId` too, matching
  each grid-group's own Segment rather than a bare clock-time string.
- `ScheduleGrid.vue` (FR-20, factored out during E07) is reused as-is here;
  `TeacherScheduleGrid.vue` (FR-21) is new. Both are fed a `schedule` prop,
  so E06's just-generated preview, E07's Versions screen, and E08's Views
  screen all render off the same components.
- Removed the redundant schedule preview E07 had added to the bottom of
  the Versões screen now that "Visualizar Horário" is the dedicated place
  to browse a version's actual grid.
- Agent-driven verification (Vite dev server + headless Chromium via
  Playwright): generated and saved a version from a 2-Class school sharing
  one Teacher across both Classes; confirmed the Per-Class view shows
  Subject + Teacher, the Per-Teacher view shows both Classes (each with
  Class + Subject) across the week, switching between them never changed
  the URL, and no console errors.
- Human Verification steps walked through and confirmed by the user
  (2026-09-21) — including the leaked-cell bug fix above.
