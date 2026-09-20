# E10 — Joint Sessions

**Status**: new

## Goal

Support shared multi-class periods (Ensino Médio "Itinerários"-style): a set
of Classes within one Segment released simultaneously into a block with
several parallel (Subject, Teacher) Tracks — without tracking any
individual-student data. Deferred until after core single-class scheduling
works end-to-end (config → generate → version → view → edit), per the
sequencing decision on `../BOARD.md`.

## Spec references

- **FR-25** — Joint Session: shared block, participating Classes all within one Segment.
- **FR-26** — no individual-student data tracked.
- **FR-27** — Tracks: (Subject, Teacher) pairs running in parallel.
- **FR-28** — weekly occurrence count for the session as a whole.
- **FR-29** — hard constraint: all participating Classes and Track Teachers simultaneously free, including against other Joint Sessions.
- **FR-30** — participation consumes weekly period budget but doesn't satisfy any (Class, Subject) requirement.
- **FR-31** — distinct display in Per-Class and Per-Teacher views.

## Human verification

1. Configure a Joint Session across multiple Classes/Grades within one
   Segment, with 2+ parallel Tracks — matching the Itinerários example in
   `sheets/HorárioEM_24.08.2026_T2.xlsx` (Ciências Humanas / Linguagens /
   Ciências da Natureza running in parallel).
2. Re-generate a schedule and confirm: the session occupies the same slot
   for every participating Class; no participating Class or Track Teacher is
   double-booked elsewhere at that time, including against another Joint
   Session.
3. Confirm the Joint Session's slot doesn't count toward any participating
   Class's individual (Class, Subject) weekly requirements (FR-30), but does
   count against its total weekly period budget (FR-13).
4. Confirm the Per-Class view labels the occurrence distinctly with the
   session's name, and the Per-Teacher view shows the specific Track that
   Teacher is booked into.

## Tasks

| ID | Task | Status |
|---|---|---|
| E10-T1 | Joint Session entity: name, participating Classes (validated same-Segment) (FR-25) | new |
| E10-T2 | Track entity: (Subject, Teacher) pairs within a Joint Session (FR-27) | new |
| E10-T3 | Weekly occurrence count config for the Joint Session as a whole (FR-28) | new |
| E10-T4 | Extend `verify`/Constructor: Joint Session hard constraints — all participating Classes and Track Teachers free, including against other Joint Sessions (FR-29) | new |
| E10-T5 | Ensure Joint Session participation consumes weekly budget without satisfying (Class, Subject) requirements; extend E05's FR-13 validation accordingly (FR-30) | new |
| E10-T6 | Extend Per-Class view: distinct Joint Session display, labeled by name (FR-31) | new |
| E10-T7 | Extend Per-Teacher view: show the specific Track booked (FR-31) | new |
| E10-T8 | Unit tests for the FR-29 constraint extension (TR-11) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
