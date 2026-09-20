# E14 — Teacher Absence & Repair

**Status**: new

## Goal

Let the user mark a Teacher absent for part or all of a specific day, and
trigger a narrow repair that fills only the vacated slot(s) — using another
Teacher already configured for that (Class, Subject) — while leaving every
other assignment untouched.

## Spec references

- **FR-35** — one-off Absence override (distinct from recurring Availability); vacates affected slot(s) immediately.
- **FR-36** — repair fills vacated slots using an already-configured (Class, Subject) Teacher who's available; everything else untouched.
- **FR-37** — unfillable slots reported specifically, not left silently empty.
- **TR-16** — reuses the same Verifier/hard-constraint model; main thread, no Worker pool, near-instant.
- **IMPL.md §4.4** (`repair`), **§5.6** (repair mode detail).

## Human verification

1. Mark a Teacher absent for specific periods on a specific day (not their
   full recurring Availability — that stays unchanged).
2. Confirm the affected Class slot(s) become vacant immediately in the
   active Schedule Version.
3. Trigger Repair; confirm any slot with another qualified, available
   Teacher (already linked to that Class/Subject per FR-9) gets filled,
   while every other assignment in the schedule is bit-for-bit unchanged.
4. Construct a case where no substitute is configured/available for a
   vacated slot; confirm it's reported as specifically unfillable, not
   silently left blank or blocking the rest of the repair.

## Tasks

| ID | Task | Status |
|---|---|---|
| E14-T1 | Absence entity: Teacher + day + affected period(s), separate from recurring Availability (FR-35) | new |
| E14-T2 | Marking an Absence vacates the corresponding slot(s) in the active Schedule Version (FR-35) | new |
| E14-T3 | Implement `repair(input, schedule, absence) -> RepairResult` in Rust: candidate search restricted to already-configured (Class, Subject) Teachers, filtered by availability and non-conflict with the unmodified rest of the schedule (FR-36, IMPL.md §5.6) | new |
| E14-T4 | Bipartite matching across multiple vacated slots in one absence (IMPL.md §5.6) | new |
| E14-T5 | Surface `RepairResult.unfillable` slots specifically in the UI (FR-37) | new |
| E14-T6 | Wire Repair to run synchronously on the main thread, no Worker pool (TR-16) | new |
| E14-T7 | Unit tests: repair never touches an unaffected slot; unfillable slots are reported, not silently dropped (TR-11) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
