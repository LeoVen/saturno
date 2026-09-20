# E06 — Solver Core: Quick Generation

**Status**: new

## Goal

Given a fully configured (non-Joint-Session) school, automatically generate
one complete, valid weekly timetable — or, if none exists, report the
specific blocking issue. This is the first checkpoint where Saturno actually
does the thing it exists to do.

## Spec references

- **FR-14** — hard constraints (excluding FR-29's Joint Session extension, deferred to E10).
- **FR-16** — infeasibility reporting (single deepest dead-end, per PRD.md §4).
- **TR-3** — solver runs off the main thread (a single Web Worker for quick mode; the full pool arrives in E13).
- **TR-9** — hard constraints modeled as a CSP.
- **TR-10** — performance target (a few seconds at sample-data scale).
- **TR-11** — pure, unit-testable solver functions.
- **IMPL.md §4.1** (`verify`), **§4.3** (`generate`), **§5.1** (Constructor), **§5.5** (quick vs. deep mode), **§6** (Rust/WASM rationale).

## Human verification

1. With a fully configured school (Segments/Classes/Teachers/Subjects/
   Assignments from E02–E05), click "Generate" and get back a complete
   schedule.
2. Manually spot-check the result: no teacher or class double-booked
   (including across Segments per D-01), no assignment on a Break, no
   availability violations, every (Class, Subject) at its exact required
   count, double periods genuinely consecutive, no more than 3 consecutive
   same-Subject periods anywhere.
3. Deliberately misconfigure something so no valid schedule exists; confirm
   a specific, readable infeasibility message appears (e.g. naming the
   Teacher/Class/Subject involved), not a generic failure.
4. Confirm generation completes within a few seconds at roughly the scale
   described in TR-10.

## Tasks

| ID | Task | Status |
|---|---|---|
| E06-T1 | Implement `verify(input, schedule) -> Vec<Violation>` in Rust covering every FR-14 hard constraint (double-booking check uses D-01's real-time comparison) | new |
| E06-T2 | Implement the Constructor: greedy/backtracking constructive search producing one feasible Schedule (IMPL.md §5.1) | new |
| E06-T3 | Expose `generate`'s quick-mode path via WASM, called from a single Web Worker (TR-3) | new |
| E06-T4 | Infeasibility reporting: surface the Constructor's deepest dead-end as a specific, readable pt-BR message (FR-16) | new |
| E06-T5 | Wire E05's FR-13 validation checks as a pre-generation gate on the "Generate" action | new |
| E06-T6 | Unit tests for hard-constraint correctness (e.g. "no output ever double-books a teacher, including across Segments") (TR-11) | new |
| E06-T7 | Verify performance against TR-10's target scale | new |

## Decisions

- See [D-01](../DECISIONS.md) — the double-booking check in `verify` compares
  real clock-time overlaps, not per-Segment slot indices.

## Notes

*(none)*
