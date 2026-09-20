// FR-2 (Teacher entity, name not unique) and FR-3 (weekly availability).
//
// D-01: availability is modeled as arbitrary (weekday, start, end) time
// ranges, not a per-Segment period-index grid, since a Teacher's
// availability applies uniformly across every Segment they teach in and
// Segments don't share a period structure.
// D-11: a Teacher defaults to fully available; the user records exceptions
// (UnavailabilityRange) rather than opting every period in.

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
}
