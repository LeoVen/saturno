// FR-8 (weekly occurrence count), FR-9 (Teacher <-> Class <-> Subject
// relationship), FR-10 (double/triple period flag, hard 3-period ceiling),
// and FR-12 (same-day repetition override) — all scoped to one (Class,
// Subject) pair, so modeled as a single entity (D-12) rather than splitting
// the weekly-count/period-shape config from the Teacher relationship.
//
// D-12: `teacherIds` holds one or more Teachers for this (Class, Subject)
// pair rather than exactly one, since FR-36 (repair) explicitly reuses
// "another Teacher already configured for that (Class, Subject) pair" —
// the schema needs room for that substitute pool from the start.

/** FR-10's absolute hard ceiling: a block of consecutive same-subject periods never exceeds 3, no matter what `consecutivePeriods` is set to. */
export const MAX_CONSECUTIVE_PERIODS = 3

export interface Assignment {
  id: string
  classId: string
  subjectId: string
  teacherIds: string[]
  /** FR-8: required periods per week for this (Class, Subject) pair. */
  weeklyOccurrences: number
  /**
   * FR-10: a *ceiling* on how long a same-(Class,Subject) run is allowed to
   * get — 1 = never consecutive, 2 = up to a double, 3 = up to a triple —
   * not a requirement that occurrences actually get grouped. A fully
   * spread-out week is always valid regardless of this value; it only ever
   * blocks a run *longer* than it (2026-09-22, user-requested
   * clarification — see impls/DECISIONS.md).
   */
  consecutivePeriods: number
  /** FR-12: off by default; the user opts in to allow more than one run of this Subject on the same day. */
  allowSameDayRepetition: boolean
}
