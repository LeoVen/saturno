// FR-13: pure, UI-independent validation checks (TR-11 pattern), run against
// plain data shapes assembled by the entities store's getters — not against
// the store itself — so these stay trivially unit-testable.

import { rangesOverlap, type ClockTime } from './time'
import { WEEKDAYS, type Weekday } from './weekday'

export interface ClassLoad {
  classId: string
  /** Sum of every Assignment's weeklyOccurrences for this Class (FR-8). */
  requiredWeekly: number
  /** This Class's Segment's Time Slot count per day * 5 weekdays (FR-5, D-02/D-10). */
  availableWeekly: number
}

/** FR-13: a Class's total weekly required occurrences exceeds its available non-break periods. */
export function findOverloadedClasses(loads: ClassLoad[]): ClassLoad[] {
  return loads.filter((l) => l.requiredWeekly > l.availableWeekly)
}

export interface TimeRange {
  weekday: Weekday
  start: ClockTime
  end: ClockTime
}

export interface AssignmentAvailabilityCheck {
  assignmentId: string
  teacherId: string
  classId: string
  /** Every (weekday, period) the Class is schedulable during (its Segment's Time Slots, across all 5 weekdays). */
  classPeriods: TimeRange[]
  /** The Teacher's configured Unavailability ranges. */
  unavailability: TimeRange[]
}

export interface ZeroOverlapWarning {
  assignmentId: string
  teacherId: string
  classId: string
}

function periodIsBlocked(period: TimeRange, unavailability: TimeRange[]): boolean {
  return unavailability.some(
    (u) => u.weekday === period.weekday && rangesOverlap(u.start, u.end, period.start, period.end),
  )
}

/**
 * FR-13: a Teacher assigned to a (Class, Subject) has zero overlapping
 * availability with that class's schedulable periods — i.e. every single
 * one of the class's periods falls inside some UnavailabilityRange.
 */
export function findZeroOverlapAssignments(
  checks: AssignmentAvailabilityCheck[],
): ZeroOverlapWarning[] {
  return checks
    .filter(
      (c) =>
        c.classPeriods.length > 0 &&
        c.classPeriods.every((p) => periodIsBlocked(p, c.unavailability)),
    )
    .map(({ assignmentId, teacherId, classId }) => ({ assignmentId, teacherId, classId }))
}

/** Every (weekday, Time Slot) a Class with `timeSlotsPerDay` slots is schedulable during, across the 5-day week. */
export function allWeeklyPeriods(timeSlots: { start: ClockTime; end: ClockTime }[]): TimeRange[] {
  return WEEKDAYS.flatMap((weekday) =>
    timeSlots.map((slot) => ({ weekday, start: slot.start, end: slot.end })),
  )
}
