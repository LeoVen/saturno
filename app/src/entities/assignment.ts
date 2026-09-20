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

/** FR-10's hard ceiling: a block of consecutive same-subject periods never exceeds 3. */
export const MAX_CONSECUTIVE_PERIODS = 3

export interface Assignment {
  id: string
  classId: string
  subjectId: string
  teacherIds: string[]
  /** FR-8: required periods per week for this (Class, Subject) pair. */
  weeklyOccurrences: number
  /** FR-10: 1 = no block (independent periods), 2 = double, 3 = triple. */
  consecutivePeriods: number
  /** FR-12: off by default; the user opts in to allow same-day repetition beyond an explicit double/triple block. */
  allowSameDayRepetition: boolean
}
