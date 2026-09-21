// FR-21 (Per-Teacher view) + FR-15's "Gap" (Janela): lays one Teacher's
// full week out as a single grid, even when they cross Segments with
// different period grids (D-01) — most Teachers only ever teach in one
// Segment, where this is exactly what was shown before; for the minority
// who cross Segments, merging is what actually answers "what does this
// Teacher's day look like," including any idle time between an assignment
// ending in one Segment and the next starting in another. That idle time
// is FR-15's Gap (today only used by the Solver's Soft Objective) —
// visualized here as a `gap` cell, distinct from a scheduled `break`.
//
// FR-31: a Teacher's Joint Session Tracks (E10) count as occupied time
// here too, right alongside their ordinary Assignment placements — from
// this Teacher's point of view, "I'm teaching a Track" and "I'm teaching
// a Class" are the same kind of commitment, so both feed the same merged
// timeline (and the same Gap detection between them).
//
// The row axis is every relevant Segment's Time Slots/Breaks merged in
// chronological order by start time. Segments can genuinely interleave
// without lining up (D-01, D-29's rationale) — two rows can therefore
// overlap in real time when their source Segments' grids don't align.
// That's an accurate reflection of the underlying data, not a bug: a
// Teacher physically can't be in two places at once, so in practice at
// most one of two such overlapping rows is ever occupied for them.
//
// Pure and UI-independent (TR-11).

import type { EntitiesSnapshot } from '../persistence/exportImport'
import type { Schedule } from '../wasm/types'
import type { Segment } from './segment'
import { WEEKDAYS, type Weekday } from './weekday'

export interface TeacherScheduleRow {
  key: string
  label: string
  kind: 'period' | 'break'
}

export interface TeacherScheduleCell {
  kind: 'occupied' | 'gap'
  /** The Class name for an ordinary placement, or the Joint Session's name for a Track (FR-31). */
  classLabel?: string
  subject?: string
}

export interface TeacherScheduleGrid {
  /** One Segment name, or several when this Teacher crosses Segments. */
  segmentNames: string[]
  rows: TeacherScheduleRow[]
  /** `${weekday}:${row.key}` -> cell. No entry means "empty" (outside this Teacher's day span, or a Break row). */
  cells: Map<string, TeacherScheduleCell>
}

function classSegment(entities: EntitiesSnapshot, classId: string): Segment | undefined {
  const schoolClass = entities.classes.find((c) => c.id === classId)
  const grade = schoolClass ? entities.grades.find((g) => g.id === schoolClass.gradeId) : undefined
  return grade ? entities.segments.find((s) => s.id === grade.segmentId) : undefined
}

interface RawRow {
  start: string
  end: string
  kind: 'period' | 'break'
  /** Every real Time Slot id (possibly from more than one Segment) sharing this exact start-end. */
  timeSlotIds: string[]
}

/** Every involved Segment's Time Slots and Breaks, deduplicated by exact (start, end) and sorted chronologically. A range that's a Time Slot in any Segment is treated as a period row (it can carry an occupied/gap cell); only a range that's a Break in every Segment defining it stays a break row. */
function buildRowPlan(segments: Segment[]): RawRow[] {
  const byRange = new Map<string, RawRow>()
  for (const segment of segments) {
    for (const t of segment.timeSlots) {
      const key = `${t.start}-${t.end}`
      const existing = byRange.get(key)
      if (existing) {
        existing.kind = 'period'
        existing.timeSlotIds.push(t.id)
      } else {
        byRange.set(key, { start: t.start, end: t.end, kind: 'period', timeSlotIds: [t.id] })
      }
    }
    for (const b of segment.breaks) {
      const key = `${b.start}-${b.end}`
      if (!byRange.has(key)) {
        byRange.set(key, { start: b.start, end: b.end, kind: 'break', timeSlotIds: [] })
      }
    }
  }
  return [...byRange.values()].sort((a, b) => a.start.localeCompare(b.start))
}

/** One thing occupying this Teacher's time — an ordinary placement or a Joint Session Track — reduced to the shape the rest of this module works with. */
interface OccupiedInterval {
  weekday: Weekday
  timeSlotId: string
  segmentId: string
  start: string
  end: string
  primaryLabel: string
  secondaryLabel: string
}

function normalOccupiedIntervals(
  entities: EntitiesSnapshot,
  schedule: Schedule,
  teacherId: string,
): OccupiedInterval[] {
  return schedule.placements
    .filter((p) => p.teacherId === teacherId)
    .flatMap((p) => {
      const segment = classSegment(entities, p.classId)
      const slot = segment?.timeSlots.find((t) => t.id === p.timeSlotId)
      if (!segment || !slot) return []
      const schoolClass = entities.classes.find((c) => c.id === p.classId)
      const grade = schoolClass
        ? entities.grades.find((g) => g.id === schoolClass.gradeId)
        : undefined
      const classLabel = [grade?.name, schoolClass?.name].filter(Boolean).join(' ') || '?'
      const subject = entities.subjects.find((s) => s.id === p.subjectId)?.name ?? '?'
      return [
        {
          weekday: p.weekday,
          timeSlotId: p.timeSlotId,
          segmentId: segment.id,
          start: slot.start,
          end: slot.end,
          primaryLabel: classLabel,
          secondaryLabel: subject,
        },
      ]
    })
}

/** FR-31: every occurrence where this Teacher staffs one of the Joint Session's Tracks — resolved via the session's first participating Class's Segment (FR-25: every participant shares one Segment, so any of them resolves the same Time Slot). */
function jointOccupiedIntervals(
  entities: EntitiesSnapshot,
  schedule: Schedule,
  teacherId: string,
): OccupiedInterval[] {
  return (schedule.jointSessionPlacements ?? []).flatMap((jp) => {
    const session = (entities.jointSessions ?? []).find((s) => s.id === jp.jointSessionId)
    const track = session?.tracks.find((t) => t.teacherId === teacherId)
    const firstClassId = session?.classIds[0]
    const segment = firstClassId ? classSegment(entities, firstClassId) : undefined
    const slot = segment?.timeSlots.find((t) => t.id === jp.timeSlotId)
    if (!session || !track || !segment || !slot) return []
    const subject = entities.subjects.find((s) => s.id === track.subjectId)?.name ?? '?'
    return [
      {
        weekday: jp.weekday,
        timeSlotId: jp.timeSlotId,
        segmentId: segment.id,
        start: slot.start,
        end: slot.end,
        primaryLabel: session.name,
        secondaryLabel: subject,
      },
    ]
  })
}

export function buildTeacherScheduleGrid(
  entities: EntitiesSnapshot,
  schedule: Schedule,
  teacherId: string,
): TeacherScheduleGrid | null {
  const occupied = [
    ...normalOccupiedIntervals(entities, schedule, teacherId),
    ...jointOccupiedIntervals(entities, schedule, teacherId),
  ]
  if (occupied.length === 0) return null

  const involvedSegmentIds = new Set(occupied.map((o) => o.segmentId))
  const segments = entities.segments.filter((s) => involvedSegmentIds.has(s.id))
  if (segments.length === 0) return null

  const rawRows = buildRowPlan(segments)
  const rows: TeacherScheduleRow[] = rawRows.map((r) => ({
    key: `${r.start}-${r.end}`,
    label: `${r.start}–${r.end}`,
    kind: r.kind,
  }))

  const cells = new Map<string, TeacherScheduleCell>()

  for (const weekday of WEEKDAYS) {
    const dayOccupied = occupied.filter((o) => o.weekday === weekday)
    if (dayOccupied.length === 0) continue

    const dayStart = dayOccupied.reduce(
      (min, o) => (o.start < min ? o.start : min),
      dayOccupied[0]!.start,
    )
    const dayEnd = dayOccupied.reduce((max, o) => (o.end > max ? o.end : max), dayOccupied[0]!.end)
    const byTimeSlotId = new Map(dayOccupied.map((o) => [o.timeSlotId, o]))

    for (const raw of rawRows) {
      if (raw.kind === 'break') continue // Break rows are a fixed divider, not per-Teacher content.

      const key = `${weekday}:${raw.start}-${raw.end}`
      const match = raw.timeSlotIds.map((id) => byTimeSlotId.get(id)).find((x) => x !== undefined)
      if (match) {
        cells.set(key, {
          kind: 'occupied',
          classLabel: match.primaryLabel,
          subject: match.secondaryLabel,
        })
      } else if (raw.start >= dayStart && raw.end <= dayEnd) {
        cells.set(key, { kind: 'gap' })
      }
    }
  }

  return { segmentNames: segments.map((s) => s.name), rows, cells }
}
