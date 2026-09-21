# E12 — Human-Readable Export

**Status**: in-progress

## Goal

Produce a schedule output meant to be printed or handed to staff who don't
use the app — comparable in layout to the school's existing spreadsheets in
`sheets/` — as both a printable document and an `.xlsx` file.

## Spec references

- **FR-22** — printable + `.xlsx`, per-Class and per-Teacher, Subject + Teacher/Class per cell, Notes included.
- **TR-13** — `@media print` + `window.print()` for printable; `exceljs` for `.xlsx`; two-days-per-row paper layout with breaks as thin dividing rows.
- **IMPL.md §9** — shared view-model between both output paths; Notes as a numbered footnote list.

## Human verification

1. From a Schedule Version with at least one slot-level note and one
   whole-schedule note, trigger the printable export (browser print dialog)
   and confirm the layout is two-days-per-row with breaks as thin dividers,
   matching the real sample sheets' feel.
2. Confirm the note footnote list appears beneath the grid, with slot-level
   notes marked by a reference marker on their cell.
3. Export the `.xlsx` version and open it in a spreadsheet application;
   confirm the same two-days-per-row layout, with cell fills/merges/column
   widths comparable to a real file in `sheets/` — not a plain data dump.
4. Confirm both outputs show Subject + Teacher (or Subject + Class, for the
   per-Teacher version) per FR-20/21, and are entirely in pt-BR.

## Tasks

| ID | Task | Status |
|---|---|---|
| E12-T1 | Shared view-model: lay out a Schedule Version's per-Class/per-Teacher data into the two-days-per-row, breaks-as-dividers shape (IMPL.md §9) | done |
| E12-T2 | `@media print` stylesheet + print trigger for the on-screen grid components (TR-13) | done |
| E12-T3 | `.xlsx` generation via `exceljs`: fills, merges, column widths matching the real sample sheets (TR-13) | done |
| E12-T4 | Notes footnote list + slot-level reference markers, identical in both output paths (FR-19, IMPL.md §9) | blocked |

## Decisions

- See [D-36](../DECISIONS.md) — the printable path is a new `ExportView.vue`
  + `ExportGridTable.vue` reading the shared view-model directly, not a
  `@media print` stylesheet layered onto `ScheduleGrid.vue`/
  `TeacherScheduleGrid.vue` as IMPL.md §9 literally describes — those
  on-screen components show one Class/Teacher at a time with weekdays as
  columns, which can't be CSS-reshaped into the real sheets' whole-Segment,
  Classes-as-columns, two-days-per-row layout without a content change.

## Notes

- **E12-T4 is blocked on E09, not implemented**: FR-19 Notes (slot-level
  and whole-schedule) don't exist anywhere yet — no entity, no field on
  `ScheduleVersion`, no UI to create one (E09 "Manual Editing, Conflicts &
  Notes" is still `new` on the Board). E12's own Human Verification step 1
  explicitly requires "a Schedule Version with at least one slot-level note
  and one whole-schedule note" to exist, which is impossible to satisfy
  before E09 ships. T1–T3 (the grid layout, print path, and `.xlsx` path)
  don't depend on Notes and are implemented; T4 (the footnote list +
  reference markers) is left undone rather than inventing Notes storage
  here — that's E09's job (E09-T3/T4/T5), and duplicating it in E12 risks
  a second, conflicting storage decision. Revisit this task once E09 lands
  a real `notes` array on `ScheduleVersion`; the view-model
  (`ExportBlock`/`ExportRow` in `scheduleExport.ts`) has no notes-shaped
  fields yet either, so wiring it in will touch `scheduleExport.ts`,
  `ExportGridTable.vue`, and `xlsxExport.ts` together.
- Real sample sheets in `sheets/` (`HorárioEF_24.08.2026_T1.xlsx`) were
  read directly (via a throwaway `openpyxl` venv, not committed) to match
  fills/merges/column structure: a bold day-name banner merged across each
  day's columns, a two-tone header row ("Horário" darker than the
  Class/Teacher-name cells), Break rows filled solid as the divider, thin
  borders throughout — colors originally matched the real sheets' yellow,
  since switched to light blue "for now" (see below). The export cell
  content itself is Subject **and** Teacher (or Class **and** Subject) per
  FR-20/21/22, even though the real sample sheets show only the Teacher's
  name per cell (school convention, not a spec requirement) — FR-22 is
  explicit that both must appear.
- **Styling follow-up, user-requested (2026-09-21)**, after reviewing the
  first version: (1) the per-Class grid's cell now shows the Teacher as
  the bigger/bold primary line and the Subject smaller beneath it (was the
  reverse) — done via a two-run `richText` value in the `.xlsx` (12pt
  bold / 9pt muted) mirroring the preview's `.primary-line`/`<small>`
  split; (2) fixed a real bug where column widths were only ever set for
  the first day's columns in each two-days-per-row block, leaving
  Tuesday/Thursday's at Excel's default width — every column across the
  widest block is now sized uniformly (bumped 16→18); (3) palette switched
  yellow→light blue (`#BFDBFE`/`#93C5FD`/`#DBEAFE`), explicitly "for now,"
  not a final decision. All three verified against real exported school
  data and confirmed by the user directly (preview screenshots + a
  downloaded `.xlsx` re-opened) — this is genuine Human Verification of
  T1–T3's actual output, even though the epic's own Human Verification
  steps 1–2 (Notes) can't be walked yet. Per the user's explicit choice,
  E12 stays `in-progress` (not `done`) until E09 lands Notes and T4 is
  built — not re-scoped elsewhere.
- `exceljs` pulls in a transitively vulnerable `uuid` (GHSA-w5hq-g745-h8pq,
  moderate) with no non-breaking fix available yet; not exploitable here
  (client-side only, uuid generation not on any untrusted-input path) —
  noted rather than downgrading to an older `exceljs`.
- Verified against the real export data (`export-2026-09-21.json`, not
  committed — same handling as D-35): imported via the Dados screen into a
  headless-Chromium session, both Per-Turma and Por Professor modes
  rendered, `.xlsx` downloaded and re-opened successfully for both modes,
  no console errors. This is agent-driven verification, not the epic's own
  Human Verification steps.
- **Layout follow-up, user-requested (2026-09-21)**: the "Horário" column
  now repeats immediately before each day's own data columns — previously
  it only appeared once at the very start of a two-days-per-row block, so
  the second day's columns had no adjacent time label. Changed in both
  output paths together (`xlsxExport.ts`'s `writeGrid`, restructured
  around a `dayBase(d)` helper so every day gets its own `[Horário][data
  columns]` group; `ExportGridTable.vue`'s header/data rows, mirroring the
  same repetition) — kept identical per D-36. E15's re-import manifest
  records column positions as they're actually written, so this needed no
  change on the import side. Verified against the real
  `export-2026-09-21.json` data (headless Chromium): both the on-screen
  preview and the downloaded `.xlsx` show "Horário" and the matching time
  label repeated before the second day's columns in every block, no
  console errors.
