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
  /** Optional for the same reason `Schedule.jointSessionPlacements` is — omit entirely and the wasm boundary's `#[serde(default)]` treats it as empty. */
  jointSessions?: {
    id: string
    name: string
    classIds: string[]
    tracks: { id: string; subjectId: string; teacherId: string }[]
    weeklyOccurrences: number
  }[]
}

export interface PlacedPeriod {
  classId: string
  subjectId: string
  teacherId: string
  weekday: Weekday
  timeSlotId: string
}

/** FR-25/27/31: one occurrence of a Joint Session — every participating Class and every Track Teacher occupied at `weekday`/`timeSlotId`, tracked separately from `placements` since it never satisfies a (Class, Subject) requirement (FR-30). */
export interface JointSessionPlacement {
  jointSessionId: string
  weekday: Weekday
  timeSlotId: string
}

export interface Schedule {
  placements: PlacedPeriod[]
  /** Optional — absent on any Schedule saved before E10 (pre-existing IndexedDB data, older Native Export Files per TR-8); always read as `?? []`, never assumed present. Always populated (possibly `[]`) on a fresh `generateQuick`/`verify` result. */
  jointSessionPlacements?: JointSessionPlacement[]
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

/** IMPL.md §4.2 (E13-T1): the FR-15 soft-objective breakdown for an already-valid Schedule — every field, including `total`, is lower-is-better (solver/src/score.rs). */
export interface ScoreBreakdown {
  teacherGapPenalty: number
  subjectDistributionPenalty: number
  total: number
}

/** IMPL.md §5.1 (E13-T2): one improved state the Refiner found — see `solver/src/refiner.rs`'s `refine` for exactly when one is emitted. */
export interface Candidate {
  schedule: Schedule
  score: ScoreBreakdown
}

/** IMPL.md §4.3/§5.1/§5.2 (E13-T3): one Worker's whole contribution to a deep-search run — Constructor once, then the Refiner for a fixed iteration count from its own seed. Provisional, not yet time-boxed/streamed (D-19-style — see impls/DECISIONS.md for `generateDeep`'s own entry); `solver/src/lib.rs`'s `generateDeep`. */
export type GenerateDeepResult =
  | { status: 'feasible'; candidates: Candidate[] }
  | { status: 'infeasible'; reason: InfeasibilityReport }
