# E12 — Human-Readable Export

**Status**: new

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
| E12-T1 | Shared view-model: lay out a Schedule Version's per-Class/per-Teacher data into the two-days-per-row, breaks-as-dividers shape (IMPL.md §9) | new |
| E12-T2 | `@media print` stylesheet + print trigger for the on-screen grid components (TR-13) | new |
| E12-T3 | `.xlsx` generation via `exceljs`: fills, merges, column widths matching the real sample sheets (TR-13) | new |
| E12-T4 | Notes footnote list + slot-level reference markers, identical in both output paths (FR-19, IMPL.md §9) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
