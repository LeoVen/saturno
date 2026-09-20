// FR-24: a named, persistent Schedule Version — what E06's Generate output
// becomes once saved, and what E08 (Views) / E09 (Manual Editing) will read
// from and write to.

import type { Schedule } from '../wasm/types'

export interface ScheduleVersion {
  id: string
  name: string
  schedule: Schedule
  /** ISO 8601 timestamp. */
  createdAt: string
  /** Set when this version was created via "Duplicar" (FR-24) from another. */
  duplicatedFromId?: string
}
