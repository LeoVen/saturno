// FR-18: maps `verify`'s Hard-Constraint Violations onto the specific
// placements they concern, so a view can flag the affected cell(s) rather
// than showing a generic "something's wrong somewhere" banner. Never
// persisted — recomputed from whatever `verify` returns each time a view
// renders (IMPL.md §4.1/§7), so a flag can't go stale.
//
// Some Violation variants don't carry enough detail to pin down one exact
// cell (e.g. TeacherDoubleBooked only names the Teacher + weekday, not
// which two of their placements overlap) — those are matched against
// every placement that's *plausibly* involved (same Teacher, same
// weekday) rather than re-deriving the Rust side's precise overlap check
// a second time in TypeScript. Over-flagging a real conflict's
// neighborhood is an acceptable tradeoff for not duplicating that logic;
// under-flagging (silently missing a violation) is not.
//
// Pure and UI-independent (TR-11).

import type { PlacedPeriod, Violation } from '../wasm/types'

function violationAppliesToPlacement(v: Violation, p: PlacedPeriod): boolean {
  switch (v.type) {
    case 'teacherDoubleBooked':
      return v.teacherId === p.teacherId && v.weekday === p.weekday
    case 'classDoubleBooked':
      return v.classId === p.classId && v.weekday === p.weekday && v.timeSlotId === p.timeSlotId
    case 'teacherUnavailable':
      return (
        v.teacherId === p.teacherId &&
        v.classId === p.classId &&
        v.weekday === p.weekday &&
        v.timeSlotId === p.timeSlotId
      )
    case 'consecutiveCeilingExceeded':
    case 'sameDayRepetition':
      return v.classId === p.classId && v.subjectId === p.subjectId && v.weekday === p.weekday
    case 'occurrenceCountMismatch':
      return v.classId === p.classId && v.subjectId === p.subjectId
    case 'teacherDailyLimitExceeded':
    case 'teacherConsecutiveLimitViolated':
      return v.teacherId === p.teacherId && v.weekday === p.weekday
  }
}

/** `${weekday}:${timeSlotId}` -> every Violation message that applies to that placement. */
export function conflictMessagesByCell(
  violations: Violation[],
  placements: PlacedPeriod[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const placement of placements) {
    const messages = violations
      .filter((v) => violationAppliesToPlacement(v, placement))
      .map((v) => v.message)
    if (messages.length > 0) {
      map.set(`${placement.weekday}:${placement.timeSlotId}`, messages)
    }
  }
  return map
}
