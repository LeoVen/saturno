# E05 — Requirements, Assignments & Validation

**Status**: new

## Goal

Let a school configure the actual scheduling requirements — how many
periods a week each (Class, Subject) needs, which Teacher teaches which
(Class, Subject), double/triple periods, per-Teacher limits, and the
same-day-repetition rule — and catch structurally bad configurations before
generation is ever attempted.

## Spec references

- **FR-8** — per-(Class, Subject) weekly occurrence count.
- **FR-9** — Teacher ↔ Class ↔ Subject relationship.
- **FR-10** — double/triple period flags, hard 3-period consecutive ceiling.
- **FR-11** — per-Teacher max periods/day and min/max consecutive periods.
- **FR-12** — same-day repetition default (off unless a double period) + per-(Class, Subject) override.
- **FR-13** — pre-generation validation warnings.

## Human verification

1. Configure a Class's weekly Subject loads (FR-8) and assign a Teacher to
   each (FR-9).
2. Flag one (Class, Subject) as a double period (FR-10); confirm the UI
   prevents configuring more than 3 consecutive periods for it.
3. Set a Teacher's max-periods-per-day limit (FR-11).
4. Deliberately configure a Class whose total weekly required occurrences
   exceeds its Segment's available non-break periods; confirm the FR-13
   warning appears.
5. Deliberately assign a Teacher to a (Class, Subject) with zero overlapping
   availability; confirm that warning appears too.

## Tasks

| ID | Task | Status |
|---|---|---|
| E05-T1 | (Class, Subject) weekly occurrence count config (FR-8) | new |
| E05-T2 | Teacher ↔ Class ↔ Subject relationship config (FR-9) | new |
| E05-T3 | Double/triple period flag per (Class, Subject), enforcing the 3-period hard ceiling at config time (FR-10) | new |
| E05-T4 | Per-Teacher max-periods/day and min/max-consecutive-periods config (FR-11) | new |
| E05-T5 | Same-day repetition default + per-(Class, Subject) override (FR-12) | new |
| E05-T6 | Validation: Class's total weekly required occurrences vs. available non-break periods (FR-13) | new |
| E05-T7 | Validation: Teacher assigned to (Class, Subject) has zero overlapping availability (FR-13, uses D-01's time-range comparison) | new |
| E05-T8 | Wire persistence for all of the above (TR-5) | new |
| E05-T9 | Unit tests for the two FR-13 validation checks (TR-11) | new |

## Decisions

- See [D-01](../DECISIONS.md) — availability-overlap validation (E05-T7)
  compares real clock times, consistent with the Verifier's approach in E06.

## Notes

*(none)*
