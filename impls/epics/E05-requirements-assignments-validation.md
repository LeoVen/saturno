# E05 — Requirements, Assignments & Validation

**Status**: done

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
| E05-T1 | (Class, Subject) weekly occurrence count config (FR-8) | done |
| E05-T2 | Teacher ↔ Class ↔ Subject relationship config (FR-9) | done |
| E05-T3 | Double/triple period flag per (Class, Subject), enforcing the 3-period hard ceiling at config time (FR-10) | done |
| E05-T4 | Per-Teacher max-periods/day and min/max-consecutive-periods config (FR-11) | done |
| E05-T5 | Same-day repetition default + per-(Class, Subject) override (FR-12) | done |
| E05-T6 | Validation: Class's total weekly required occurrences vs. available non-break periods (FR-13) | done |
| E05-T7 | Validation: Teacher assigned to (Class, Subject) has zero overlapping availability (FR-13, uses D-01's time-range comparison) | done |
| E05-T8 | Wire persistence for all of the above (TR-5) | done |
| E05-T9 | Unit tests for the two FR-13 validation checks (TR-11) | done |

## Decisions

- See [D-01](../DECISIONS.md) — availability-overlap validation (E05-T7)
  compares real clock times, consistent with the Verifier's approach in E06.
- See [D-12](../DECISIONS.md) — Assignment combines FR-8/9/10/12 into one
  entity, with a Teacher pool (`teacherIds`) rather than a single Teacher.
- See [D-13](../DECISIONS.md) — precise definitions used for FR-13's two
  validation checks.

## Notes

- Implementation: `app/src/entities/assignment.ts` (`Assignment` type,
  `MAX_CONSECUTIVE_PERIODS = 3`); `app/src/entities/validation.ts` (pure,
  unit-tested `findOverloadedClasses`/`findZeroOverlapAssignments`/
  `allWeeklyPeriods`, TR-11 style — operate on plain data shapes, not the
  store); `rangesOverlap` added to `entities/time.ts`; `entities/teacher.ts`
  extended with optional `maxPeriodsPerDay`/`minConsecutivePeriods`/
  `maxConsecutivePeriods` (FR-11); `stores/entities.ts` extended with
  Assignment CRUD (`addAssignment` enforces one-per-(Class,Subject) and
  valid parents; `setConsecutivePeriods` enforces the FR-10 ceiling;
  `setWeeklyOccurrences` rejects non-positive integers), `setTeacherLimits`,
  and two warning getters (`overloadedClasses`, `zeroOverlapAssignments`)
  that assemble live state into the pure validation functions' input shape.
  Cascades: removing a Segment/Grade/Class/Subject removes the Assignments
  that reference it; removing a Teacher only unlinks it from `teacherIds`
  (the Assignment survives, same as FR-9 not being fully lost when one
  Teacher goes away).
  UI: `AssignmentsConfig.vue` (Class × Subject picker, weekly-count/
  consecutive-periods/same-day/Teacher-multi-select editor, a table of all
  Assignments, and an "Avisos de validação" section rendering both FR-13
  warning types); `TeachersConfig.vue` gained a "Limites do professor"
  panel (FR-11) above the availability grid.
- The FR-10 "UI prevents configuring more than 3 consecutive periods"
  requirement (Human Verification #2) is satisfied structurally: the
  consecutive-periods control is a `<select>` with only options 1/2/3 — a
  4th option was never rendered, not merely rejected after the fact. The
  store's `setConsecutivePeriods` also rejects anything outside 1–3
  directly, so the ceiling holds even if a future UI (e.g. Deep Search's
  bulk config) bypasses the dropdown.
- **Verification performed by the agent** (2026-09-20): full unit suite
  (`npm test`, 58 tests, up from 32 — 26 new covering Teacher limits,
  Assignment CRUD, cascades, and both FR-13 validation getters/pure
  functions) passes; `npm run lint`, `npm run format`, and `npm run build`
  are all clean. Also drove the real app end-to-end with a headless
  Playwright browser through all 5 of this epic's Human Verification steps:
  configured a Class's weekly Matemática load (3/week) with a double-period
  flag and a Teacher assigned; confirmed the consecutive-periods dropdown
  offers no option past 3; set that Teacher's max-periods-per-day limit;
  added a Geografia load of 20/week (pushing the Class's total to 23 against
  10 available periods) and confirmed the overload warning appeared with the
  correct aggregate numbers; assigned a second Teacher blocked all week to
  the Geografia Assignment and confirmed the zero-overlap warning appeared
  naming that Teacher, Class, and Subject; reloaded and confirmed every
  Assignment and both warnings persisted exactly. No console errors. This
  is exactly this epic's Human Verification list, but run by the agent, not
  an actual human — per `PROCESS.md` §4/§6, E05-T8 and the epic itself stay
  `in-review` until a human walks through the steps above and flips them to
  `done`.
- **Human verification confirmed** (2026-09-20): user reviewed and signed
  off ("Looks good"). E05-T8 and the epic moved to `done`.
- **Retrofit** (2026-09-20): the Assignment Teacher picker (FR-9) is now
  narrowed to Teachers qualified for that Subject — see [D-25](../DECISIONS.md).
