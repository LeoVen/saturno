# E08 — Views: Per-Class & Per-Teacher

**Status**: in-review

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
  not one Segment's own period list.

## Notes

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
  the URL, and no console errors. This is agent-driven verification, not
  the epic's own Human Verification steps — those still need a person to
  walk them before this epic moves to `done`.
