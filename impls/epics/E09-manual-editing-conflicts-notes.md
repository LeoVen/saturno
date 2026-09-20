# E09 — Manual Editing, Conflicts & Notes

**Status**: new

## Goal

Let the user hand-tune a generated schedule the way schools already do
today — move or swap assignments, see (but not be blocked by) any conflicts
that introduces, and annotate the reason with a note.

## Spec references

- **FR-17** — move/swap an individual period assignment.
- **FR-18** — conflict flag on a hard-constraint violation from a manual edit; not blocked; recomputed live via `verify` on render, never persisted (PRD.md §4).
- **FR-19** — free-text note on a slot or on the whole schedule, scoped to the Schedule Version.

## Human verification

1. Move an assignment to a different slot in the Per-Class view (E08);
   confirm the grid updates.
2. Deliberately move an assignment into a slot that creates a double-booking
   or availability violation; confirm the affected slot(s) are visibly
   flagged, and confirm the edit is still saved (not blocked).
3. Fix the conflict (or leave it) and confirm the flag updates live, next
   render, without needing to re-run generation.
4. Attach a note to a specific slot and a separate note to the schedule as a
   whole; reload and confirm both persisted, scoped to this Schedule
   Version specifically (not visible from a different version).

## Tasks

| ID | Task | Status |
|---|---|---|
| E09-T1 | Move/swap an assignment in the grid UI (FR-17) | new |
| E09-T2 | Call `verify` on every relevant render of the affected view and surface violations as a visible flag, without blocking the save (FR-18) | new |
| E09-T3 | Slot-level note: attach/edit/remove free text on one slot (FR-19) | new |
| E09-T4 | Whole-schedule note: attach/edit/remove free text on the Schedule Version as a whole (FR-19) | new |
| E09-T5 | Wire Notes into the schedule-versions store, not the entities store (TR-5, per PRD.md §4's FR-19 storage decision) | new |

## Decisions

*(none yet — but see PRD.md §4's existing FR-18/FR-19 storage decisions, already resolved before v5.)*

## Notes

*(none)*
