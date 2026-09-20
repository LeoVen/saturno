# E03 — Grades, Classes & Subjects

**Status**: new

## Goal

Let a school define its Grades (year/level) within a Segment, the Classes
(sections) within each Grade, and a global Subject catalog — the units the
solver ultimately builds a schedule for.

## Spec references

- **FR-6** — Grade belongs to one Segment; Class belongs to one Grade and is the actual schedulable unit.
- **FR-7** — global Subject catalog.

## Human verification

1. Under the "Ensino Fundamental" Segment, create Grade "7º Ano" with two
   Classes: "7º Ano A" and "7º Ano B", matching the real example in
   `sheets/HorárioEF_24.08.2026_T1.xlsx`.
2. Create a Subject catalog entry (e.g. "História").
3. Reload the browser and confirm everything persisted, with Classes
   correctly nested under their Grade and Segment.

## Tasks

| ID | Task | Status |
|---|---|---|
| E03-T1 | Grade entity: create/edit/delete, belongs to exactly one Segment (FR-6) | new |
| E03-T2 | Class entity: create/edit/delete, belongs to exactly one Grade (FR-6) | new |
| E03-T3 | Subject entity: global catalog, create/edit/delete (FR-7) | new |
| E03-T4 | Config UI: Grades/Classes nested under their Segment | new |
| E03-T5 | Config UI: global Subject catalog | new |
| E03-T6 | Wire persistence for Grade/Class/Subject (TR-5) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
