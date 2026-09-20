// FR-2 (Teacher entity, name not unique), FR-3 (weekly availability), and
// FR-11 (optional per-Teacher daily/consecutive-period limits).
//
// D-01: availability is modeled as arbitrary (weekday, start, end) time
// ranges, not a per-Segment period-index grid, since a Teacher's
// availability applies uniformly across every Segment they teach in and
// Segments don't share a period structure.
// D-11: a Teacher defaults to fully available; the user records exceptions
// (UnavailabilityRange) rather than opting every period in.
// D-25: `subjectIds` is a data-entry aid (which Subjects this Teacher can
// teach), used to narrow the Teacher picker on an Assignment (FR-9) — not a
// new hard constraint, and an Assignment's own `teacherIds` (D-12) is
// unaffected in shape.

import type { ClockTime } from './time'
import type { Weekday } from './weekday'

export interface UnavailabilityRange {
  id: string
  weekday: Weekday
  start: ClockTime
  end: ClockTime
}

export interface Teacher {
  id: string
  name: string
  unavailability: UnavailabilityRange[]
  /** D-25: which Subjects this Teacher can teach. */
  subjectIds: string[]
  /** FR-11: all three limits are optional — undefined means "no limit configured". */
  maxPeriodsPerDay?: number
  minConsecutivePeriods?: number
  maxConsecutivePeriods?: number
}
