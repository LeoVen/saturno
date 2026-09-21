# E09 — Manual Editing, Conflicts & Notes

**Status**: done

## Goal

Let the user hand-tune a generated schedule the way schools already do
today — move or swap assignments, see (but not be blocked by) any conflicts
that introduces, and annotate the reason with a note.

## Spec references

- **FR-17** — move/swap an individual period assignment.
- **FR-18** — conflict flag on a hard-constraint violation from a manual edit; not blocked; recomputed live via `verify` on render, never persisted (PRD.md §4).
- **FR-19** — free-text note on a slot or on the whole schedule, scoped to the Schedule Version.

## Human verification

All of the below happen on the new "Ajustar Horário" screen (D-39) — not
"Visualizar Horário" (E08), which is read-only.

1. On "Ajustar Horário", click "Editar uma cópia" on a saved version;
   confirm a new version named "{original} (rascunho)" appears and its
   editable grid opens. Move an assignment to a different slot; confirm
   the grid updates.
2. Deliberately move an assignment into a slot that creates a double-booking
   or availability violation; confirm the affected slot(s) are visibly
   flagged, and confirm the edit is still saved (not blocked).
3. Fix the conflict (or leave it) and confirm the flag updates live, next
   render, without needing to re-run generation.
4. Attach a note to a specific slot and a separate note to the schedule as a
   whole; reload and confirm both persisted, scoped to this Schedule
   Version specifically (not visible from a different version).
5. Switch to "Visualizar Horário" (or "Versões") and confirm the
   *original* version the draft was copied from shows no trace of the
   edit — untouched.
6. Back on "Ajustar Horário", confirm the draft can be resumed
   ("Continuar editando") without creating yet another copy, and
   discarded ("Descartar rascunho") without affecting the original.

## Tasks

| ID | Task | Status |
|---|---|---|
| E09-T1 | Move/swap an assignment in the grid UI (FR-17) | done |
| E09-T2 | Call `verify` on every relevant render of the affected view and surface violations as a visible flag, without blocking the save (FR-18) | done |
| E09-T3 | Slot-level note: attach/edit/remove free text on one slot (FR-19) | done |
| E09-T4 | Whole-schedule note: attach/edit/remove free text on the Schedule Version as a whole (FR-19) | done |
| E09-T5 | Wire Notes into the schedule-versions store, not the entities store (TR-5, per PRD.md §4's FR-19 storage decision) | done |

## Decisions

- See [D-38](../DECISIONS.md) — building T2 (live conflict flag) surfaced
  two real, pre-existing bugs in already-shipped E06 code (`verifySchedule`
  never cloning its `schedule` argument before `postMessage`, and the Rust
  `Violation` enum serializing its fields as snake_case despite the TS side
  assuming camelCase) — both fixed, with a new Rust regression test for the
  second one.
- See [D-39](../DECISIONS.md) — after using the first version, moved this
  epic's whole UI off "Visualizar Horário" (E08) onto a new "Ajustar
  Horário" screen that only ever edits an explicit, `isDraft`-marked copy
  of a version, never the version itself. Store actions/pure logic
  (`movePlacement`, `addNote`/`updateNote`/`removeNote`, the conflict-flag
  mapping) are unchanged — only where the UI lives and how a version
  becomes editable changed.
- PRD.md §4's existing FR-18/FR-19 storage decisions (conflict flags never
  persisted; Notes live on the Schedule Version, not entities) stood as
  written — no deviation needed.

## Notes

- **Design choices made building this** (none forced by the spec, but
  worth recording): FR-17's move/swap is click-to-pick-up-then-click-to-place
  (not native HTML5 drag-and-drop) — clicking a cell with a placement
  "picks it up" (highlighted via the existing `.pill.selected` style),
  clicking a second cell moves it there, or swaps if that cell is already
  occupied. Only wired into `ScheduleGrid.vue`'s Per-Class view (FR-17's
  own Human Verification step 1 names that view specifically), gated by
  `editable`/`versionId` props — `true` only from the new "Ajustar
  Horário" screen (D-39), and only for a version with `isDraft: true`;
  `false` (unchanged, read-only) everywhere else `ScheduleGrid` is reused
  (E06's just-generated preview, "Visualizar Horário"), since Notes need a
  real, saved `versionId` to attach to and edits need a version that's
  safe to mutate.
- FR-18's conflict flag is scoped to whatever `Violation` fields are
  available: exact-match violations (`ClassDoubleBooked`, `TeacherUnavailable`)
  flag the one exact cell; violations that only name a Teacher + weekday
  (`TeacherDoubleBooked`, daily/consecutive limits) flag every one of that
  Teacher's placements that day rather than re-deriving the Rust side's
  precise real-clock-time overlap check a second time in TypeScript —
  over-flagging a real conflict's neighborhood, never under-flagging. See
  `entities/conflictFlags.ts`.
- FR-19's Notes: a flat, unbounded list per Schedule Version (not "exactly
  one note per slot/schedule"), each either `slot`-scoped or whole-schedule
  — matches the real sample sheets' numbered "Observação 1/2" convention
  (multiple general remarks) that E12 is expected to render as a footnote
  list once E12-T4 is unblocked. `ScheduleVersion.notes` is optional
  (`notes?:`) for backward compatibility with Schedule Versions saved
  before this epic — always read via the store's `notesFor`/`noteForSlot`
  getters, never the field directly, so the `?? []` default lives in
  exactly one place.
- Verified end-to-end against a small synthetic fixture (not the real
  school export — deliberately built to force a `TeacherDoubleBooked`
  violation) in a headless-Chromium session, twice: once for the original
  (E08-hosted) UI — move, swap, live conflict flag appearing/clearing,
  slot note, whole-schedule note, all surviving a full page reload — and
  again after D-39's reorg, confirming "Visualizar Horário" is fully
  read-only (no note buttons, no "Observações" card), "Ajustar Horário"
  shows no editable grid until a draft is explicitly started, and —
  critically — the original version is provably untouched (re-activated
  via "Versões" and inspected) after editing and moving a placement on its
  draft copy. No console errors in either round. This is agent-driven
  verification, not the epic's own Human Verification steps — those were
  walked through and confirmed by the user (2026-09-21).
