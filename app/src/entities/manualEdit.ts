// FR-17: manually move or swap one Class's placement in a generated
// Schedule. Pure and UI-independent (TR-11) — the store action wraps this
// with the actual Pinia-state lookup/mutation.
//
// Never blocked by a Hard Constraint (FR-18 handles flagging separately,
// live via `verify`, not here) — this function only rejects a move that
// doesn't correspond to a real placement to begin with.

import type { PlacedPeriod, Schedule } from '../wasm/types'
import type { Weekday } from './weekday'

export interface SlotRef {
  classId: string
  weekday: Weekday
  timeSlotId: string
}

function findIndex(placements: PlacedPeriod[], slot: SlotRef): number {
  return placements.findIndex(
    (p) =>
      p.classId === slot.classId && p.weekday === slot.weekday && p.timeSlotId === slot.timeSlotId,
  )
}

/**
 * Moves the placement at `from` to `to`. If `to` is already occupied, the
 * two placements swap positions instead of one overwriting the other —
 * matching the Glossary's "Manual Editing: moving OR swapping." Returns a
 * new `Schedule` (the input is never mutated) plus whether anything
 * actually changed, or `null` if `from` has no placement to move.
 */
export function movePlacement(
  schedule: Schedule,
  from: SlotRef,
  to: SlotRef,
): { schedule: Schedule; changed: boolean } | null {
  const fromIndex = findIndex(schedule.placements, from)
  if (fromIndex === -1) return null
  if (from.weekday === to.weekday && from.timeSlotId === to.timeSlotId) {
    return { schedule, changed: false }
  }

  const placements = schedule.placements.map((p) => ({ ...p }))
  const toIndex = findIndex(placements, to)

  placements[fromIndex]!.weekday = to.weekday
  placements[fromIndex]!.timeSlotId = to.timeSlotId
  if (toIndex !== -1) {
    placements[toIndex]!.weekday = from.weekday
    placements[toIndex]!.timeSlotId = from.timeSlotId
  }

  return { schedule: { placements }, changed: true }
}
