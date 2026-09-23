# E15 — Excel Round-Trip Import

**Status**: done

## Goal

Let the "Por Turma" `.xlsx` produced by the Human-Readable Export (E12) be
brought back into Saturno — as long as its sheets/cells weren't rearranged
— reconstructing the schedule it shows as a new Schedule Version. This is
distinct from E11 (JSON is the full-state, not-meant-for-hand-editing
native format) and from the rest of E12 (that `.xlsx` stays a one-way,
print-comparable output) — see [D-41](../DECISIONS.md).

## Spec references

None directly — this is new scope, not called out in `specs/`. Builds on
top of FR-22/TR-13's existing `.xlsx` shape (E12) and reuses FR-24's
version-creation convention (`createFromSchedule`). See
[D-41](../DECISIONS.md) for how this sits next to FR-23/TR-12's "native
format is JSON, not meant for hand-editing" framing and FR.md's "legacy
spreadsheet import... out of scope for v1" line — neither actually covers
this (round-tripping Saturno's own export, not bootstrapping from an
arbitrary teacher-made file).

## Human verification

1. With an active Schedule Version, go to "Exportar", download the "Por
   Turma" `.xlsx`.
2. Go to "Dados", upload that same file in the new "Excel (.xlsx)" card.
   Confirm a new Schedule Version named "Importado do Excel — <date>"
   appears in "Versões", is active, and its grid (via "Visualizar
   Horário") matches what was exported.
3. Open the downloaded file in Excel/LibreOffice, clear a few cells and/or
   edit a Teacher or Subject name in a cell to something else *that
   exists* in the current profile, save, and reimport. Confirm the cleared
   slots are empty in the new version and the edited cells reflect the new
   name.
4. Rename or delete one of the visible sheet tabs, or type a name that
   matches no current Teacher/Subject, save, and reimport. Confirm import
   is rejected with a clear pt-BR error (not a partial or silently-wrong
   import).
5. Try importing an unrelated `.xlsx` (or an older Saturno export from
   before this epic). Confirm the same clear rejection.

## Tasks

| ID | Task | Status |
|---|---|---|
| E15-T1 | Hidden re-import manifest embedded in the "Por Turma" workbook (row/col → classId/weekday/timeSlotId), written alongside the visible grid | done |
| E15-T2 | Pure import function: manifest + current entities → `Schedule`, resolving Teacher/Subject by name (D-17 disambiguation aware), all-or-nothing on any unresolvable cell | done |
| E15-T3 | "Dados" screen: upload `.xlsx`, on success create a new Schedule Version via `createFromSchedule` (never overwrites), on failure show every error | done |
| E15-T4 | Unit tests: manifest round-trip (incl. through a real buffer save/load), cell resolution, blank-cell-clears, missing-manifest/renamed-sheet/unknown-name error paths | done |

## Decisions

- See [D-41](../DECISIONS.md) — scope, the hidden-manifest mechanism, and
  "always creates a new version" (confirmed with the user).

## Notes

- Only the per-Class ("Por Turma") workbook is round-trippable — it's the
  complete representation (one column per Class × one row per
  weekday/Time-Slot covers every placement). The per-Teacher ("Por
  Professor") workbook stays export-only; it's a derived view of the same
  data and importing it back would just be a second, redundant path to the
  same `Schedule`.
- Entities (Segments/Grades/Classes/Subjects/Teachers/Time Slots) are never
  created or modified by this import — they must already exist in the
  current profile. Only the schedule (which Teacher+Subject sits in which
  Class/weekday/Time-Slot) round-trips.
- Joint Sessions don't appear in the "Por Turma" export at all yet (a
  pre-existing gap flagged in D-40's notes, not this epic's scope), so
  they're absent from the reimported `Schedule` too
  (`jointSessionPlacements: []`) — round-tripping a schedule that used
  Joint Sessions will silently drop them until that gap is closed.
- Agent-driven verification (Vite dev server + headless Chromium via
  Playwright, same convention as E11/E12): imported the real
  `export-2026-09-21.json` fixture (25 Teachers, 8 Classes, 220
  placements) through the actual UI, downloaded its "Por Turma" `.xlsx`,
  reimported that same file through the new "Dados" card, and diffed the
  resulting Schedule Version's placements against the source — exact
  match, 0 missing/extra. Also confirmed the pre-E15 `.xlsx` already
  sitting in the repo root (generated before this epic, no manifest) is
  rejected with the intended pt-BR error rather than a silent
  misinterpretation. No console errors. This is agent-driven verification,
  not the epic's own Human Verification steps above.
- **Human Verification walked by the user (2026-09-23)**: confirmed —
  epic moved to `done`.
