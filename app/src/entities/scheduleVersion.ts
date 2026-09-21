// FR-24: a named, persistent Schedule Version — what E06's Generate output
// becomes once saved, and what E08 (Views) / E09 (Manual Editing) read from
// and write to.

import type { Schedule } from '../wasm/types'
import type { Weekday } from './weekday'

/**
 * FR-19: a free-text annotation scoped to one Schedule Version — either
 * attached to a specific slot (`slot` present) or to the schedule as a
 * whole (`slot` absent), typically recording the reason for a Manual Edit
 * (FR-17). IMPL.md §9: both kinds render as one numbered "Observação N"
 * footnote list in the Human-Readable Export, a slot-level Note additionally
 * getting a reference marker on its cell.
 */
export interface ScheduleNote {
  id: string
  text: string
  /** ISO 8601 timestamp. */
  createdAt: string
  slot?: {
    classId: string
    weekday: Weekday
    timeSlotId: string
  }
}

export interface ScheduleVersion {
  id: string
  name: string
  schedule: Schedule
  /** ISO 8601 timestamp. */
  createdAt: string
  /** Set when this version was created via "Duplicar" (FR-24) from another. */
  duplicatedFromId?: string
  /** FR-19. Optional — absent on any Schedule Version saved before E09, and on older Native Export Files (TR-8): always read via the store's `notesFor` getter, never this field directly, so that's handled in exactly one place. */
  notes?: ScheduleNote[]
}
