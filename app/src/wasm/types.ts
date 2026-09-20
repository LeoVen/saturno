// Hand-written TS types mirroring the Rust solver's serde-shaped JSON
// (solver/src/model.rs) — `wasm-bindgen`'s generated `.d.ts` types the
// `verify`/`generateQuick` exports as `any` (data crosses the boundary as
// plain JSON per IMPL.md §6), so these are what the JS side actually codes
// against.

import type { Weekday } from '../entities/weekday'

/** What `generateQuick` takes: the entities store's own shapes, flattened. */
export interface ScheduleInput {
  segments: {
    id: string
    name: string
    timeSlots: { id: string; start: string; end: string }[]
    breaks: { id: string; start: string; end: string }[]
  }[]
  grades: { id: string; segmentId: string; name: string }[]
  classes: { id: string; gradeId: string; name: string }[]
  subjects: { id: string; name: string }[]
  teachers: {
    id: string
    name: string
    unavailability: { id: string; weekday: Weekday; start: string; end: string }[]
    maxPeriodsPerDay?: number
    minConsecutivePeriods?: number
    maxConsecutivePeriods?: number
  }[]
  assignments: {
    id: string
    classId: string
    subjectId: string
    teacherIds: string[]
    weeklyOccurrences: number
    consecutivePeriods: number
    allowSameDayRepetition: boolean
  }[]
}

export interface PlacedPeriod {
  classId: string
  subjectId: string
  teacherId: string
  weekday: Weekday
  timeSlotId: string
}

export interface Schedule {
  placements: PlacedPeriod[]
}

/** FR-14 hard-constraint violations (solver/src/model.rs's `Violation` enum, tagged by `type`). */
export type Violation =
  | { type: 'teacherDoubleBooked'; teacherId: string; weekday: Weekday; message: string }
  | {
      type: 'classDoubleBooked'
      classId: string
      weekday: Weekday
      timeSlotId: string
      message: string
    }
  | {
      type: 'occurrenceCountMismatch'
      assignmentId: string
      classId: string
      subjectId: string
      required: number
      actual: number
      message: string
    }
  | {
      type: 'teacherUnavailable'
      teacherId: string
      classId: string
      weekday: Weekday
      timeSlotId: string
      message: string
    }
  | {
      type: 'consecutiveBlockBroken'
      assignmentId: string
      classId: string
      subjectId: string
      message: string
    }
  | {
      type: 'consecutiveCeilingExceeded'
      classId: string
      subjectId: string
      weekday: Weekday
      runLength: number
      message: string
    }
  | { type: 'teacherDailyLimitExceeded'; teacherId: string; weekday: Weekday; message: string }
  | {
      type: 'teacherConsecutiveLimitViolated'
      teacherId: string
      weekday: Weekday
      message: string
    }
  | {
      type: 'sameDayRepetition'
      assignmentId: string
      classId: string
      subjectId: string
      weekday: Weekday
      message: string
    }

/** FR-16: the Constructor's single deepest dead-end. */
export interface InfeasibilityReport {
  message: string
  classId: string | null
  subjectId: string | null
  teacherIds: string[]
}

export type GenerateResult =
  { status: 'feasible'; schedule: Schedule } | { status: 'infeasible'; reason: InfeasibilityReport }
