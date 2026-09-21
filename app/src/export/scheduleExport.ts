// FR-22, TR-13, IMPL.md §9: the Human-Readable Export's shared view-model.
// Lays a Schedule Version out into the paper-oriented "two-days-per-row"
// shape used by every real sample sheet in `sheets/` (day pairs Mon+Tue,
// Wed+Thu, Fri alone; Breaks as their own divider row in chronological
// position). Both output paths — the printable `@media print` view and the
// `.xlsx` workbook — render off this same structure, so they can't drift
// apart from each other.
//
// Pure and UI-independent (TR-11): no DOM, no exceljs, no store access.

import type { EntitiesSnapshot } from '../persistence/exportImport'
import type { PlacedPeriod, Schedule } from '../wasm/types'
import type { Segment } from '../entities/segment'
import type { Weekday } from '../entities/weekday'
import { WEEKDAY_EXPORT_PAIRS, WEEKDAY_LABELS_FULL } from '../entities/weekday'

/** One cell's display-ready content, `lines[0]` rendered with more emphasis (bigger/bolder) than the rest — for the per-Class grid, Teacher then Subject (FR-20's data, Teacher given the visual priority per user request 2026-09-21); for the per-Teacher grid, Class then Subject (FR-21). `null` means the slot is unoccupied. */
export interface ExportCell {
  lines: string[]
}

export interface ExportRow {
  kind: 'period' | 'break'
  timeSlotId?: string
  timeLabel: string
  /** One entry per day in this block (1 for the trailing Friday-only block, 2 otherwise); each entry is one cell per column, in column order. A Break row carries no cell content (`null`s) — it's rendered as a thin divider. */
  cellsByDay: (ExportCell | null)[][]
}

export interface ExportColumn {
  key: string
  label: string
}

export interface ExportBlock {
  days: { weekday: Weekday; label: string }[]
  rows: ExportRow[]
}

export interface ClassGridExport {
  segmentId: string
  segmentName: string
  columns: ExportColumn[]
  blocks: ExportBlock[]
}

export interface TeacherGridExport {
  teacherId: string
  teacherLabel: string
  segmentId: string
  segmentName: string
  /** Always the single Teacher's own column — kept as an array (rather than a bare label) so `TeacherGridExport` shares its rendering shape with `ClassGridExport`. */
  columns: ExportColumn[]
  blocks: ExportBlock[]
}

interface RowPlanEntry {
  kind: 'period' | 'break'
  timeSlotId?: string
  timeLabel: string
  start: string
}

/** A Segment's Time Slots and Breaks merged into one chronological row plan. The row structure is identical across every weekday (D-02), so it's computed once per Segment rather than per day. */
function buildRowPlan(segment: Segment): RowPlanEntry[] {
  const periodRows: RowPlanEntry[] = segment.timeSlots.map((t) => ({
    kind: 'period',
    timeSlotId: t.id,
    timeLabel: `${t.start}–${t.end}`,
    start: t.start,
  }))
  const breakRows: RowPlanEntry[] = segment.breaks.map((b) => ({
    kind: 'break',
    timeLabel: `${b.start}–${b.end}`,
    start: b.start,
  }))
  return [...periodRows, ...breakRows].sort((a, b) => a.start.localeCompare(b.start))
}

function classSegment(entities: EntitiesSnapshot, classId: string): Segment | undefined {
  const schoolClass = entities.classes.find((c) => c.id === classId)
  const grade = schoolClass ? entities.grades.find((g) => g.id === schoolClass.gradeId) : undefined
  return grade ? entities.segments.find((s) => s.id === grade.segmentId) : undefined
}

/** D-17: same-name-Teacher disambiguation, mirrored from the entities store's `teacherLabel` getter (kept pure/standalone here rather than importing the store). */
function teacherLabelFor(entities: EntitiesSnapshot, teacherId: string): string {
  const teacher = entities.teachers.find((t) => t.id === teacherId)
  if (!teacher) return '?'
  const sameName = entities.teachers.filter((t) => t.name === teacher.name)
  if (sameName.length <= 1) return teacher.name
  return `${teacher.name} (${sameName.findIndex((t) => t.id === teacherId) + 1})`
}

function buildBlocks(
  rowPlan: RowPlanEntry[],
  columns: ExportColumn[],
  cellFor: (columnKey: string, weekday: Weekday, timeSlotId: string) => ExportCell | null,
): ExportBlock[] {
  return WEEKDAY_EXPORT_PAIRS.map((pair) => ({
    days: pair.map((weekday) => ({ weekday, label: WEEKDAY_LABELS_FULL[weekday] })),
    rows: rowPlan.map((row) => ({
      kind: row.kind,
      timeSlotId: row.timeSlotId,
      timeLabel: row.timeLabel,
      cellsByDay: pair.map((weekday) =>
        row.kind === 'period' && row.timeSlotId
          ? columns.map((col) => cellFor(col.key, weekday, row.timeSlotId!))
          : columns.map(() => null),
      ),
    })),
  }))
}

/**
 * FR-20/FR-22: one grid per Segment, columns = every Class belonging to
 * that Segment — matching the real sample sheets' whole-segment layout
 * exactly (unlike the on-screen FR-20 view, which shows one Class at a
 * time via a picker; the export shows the whole school at a glance, same
 * as the paper version staff already use).
 */
export function buildClassGridExports(
  entities: EntitiesSnapshot,
  schedule: Schedule,
): ClassGridExport[] {
  const exports: ClassGridExport[] = []

  for (const segment of entities.segments) {
    if (segment.timeSlots.length === 0) continue

    const grades = entities.grades.filter((g) => g.segmentId === segment.id)
    const columns: ExportColumn[] = grades.flatMap((grade) =>
      entities.classes
        .filter((c) => c.gradeId === grade.id)
        .map((c) => ({ key: c.id, label: `${grade.name} ${c.name}` })),
    )
    if (columns.length === 0) continue

    const placementIndex = new Map<string, PlacedPeriod>()
    for (const p of schedule.placements) {
      if (classSegment(entities, p.classId)?.id !== segment.id) continue
      placementIndex.set(`${p.classId}:${p.weekday}:${p.timeSlotId}`, p)
    }

    const cellFor = (classId: string, weekday: Weekday, timeSlotId: string): ExportCell | null => {
      const placement = placementIndex.get(`${classId}:${weekday}:${timeSlotId}`)
      if (!placement) return null
      const subject = entities.subjects.find((s) => s.id === placement.subjectId)?.name ?? '?'
      return { lines: [teacherLabelFor(entities, placement.teacherId), subject] }
    }

    exports.push({
      segmentId: segment.id,
      segmentName: segment.name,
      columns,
      blocks: buildBlocks(buildRowPlan(segment), columns, cellFor),
    })
  }

  return exports
}

/**
 * FR-21/FR-22: one grid per (Teacher, Segment) they teach in, mirroring the
 * on-screen Per-Teacher view's per-Segment grouping (D-29) — a Teacher who
 * crosses Segments with different period grids gets one block per Segment
 * rather than one merged, ambiguous grid.
 */
export function buildTeacherGridExports(
  entities: EntitiesSnapshot,
  schedule: Schedule,
): TeacherGridExport[] {
  const exports: TeacherGridExport[] = []

  for (const teacher of entities.teachers) {
    const segmentsForTeacher = new Map<string, Segment>()
    for (const p of schedule.placements) {
      if (p.teacherId !== teacher.id) continue
      const segment = classSegment(entities, p.classId)
      if (segment) segmentsForTeacher.set(segment.id, segment)
    }
    if (segmentsForTeacher.size === 0) continue

    const teacherLabel = teacherLabelFor(entities, teacher.id)
    const column: ExportColumn = { key: teacher.id, label: teacherLabel }

    for (const segment of entities.segments) {
      if (!segmentsForTeacher.has(segment.id)) continue

      const placementIndex = new Map<string, PlacedPeriod>()
      for (const p of schedule.placements) {
        if (p.teacherId !== teacher.id) continue
        if (classSegment(entities, p.classId)?.id !== segment.id) continue
        placementIndex.set(`${p.weekday}:${p.timeSlotId}`, p)
      }

      const cellFor = (
        _columnKey: string,
        weekday: Weekday,
        timeSlotId: string,
      ): ExportCell | null => {
        const placement = placementIndex.get(`${weekday}:${timeSlotId}`)
        if (!placement) return null
        const schoolClass = entities.classes.find((c) => c.id === placement.classId)
        const grade = schoolClass
          ? entities.grades.find((g) => g.id === schoolClass.gradeId)
          : undefined
        const classLabel = [grade?.name, schoolClass?.name].filter(Boolean).join(' ') || '?'
        const subject = entities.subjects.find((s) => s.id === placement.subjectId)?.name ?? '?'
        return { lines: [classLabel, subject] }
      }

      exports.push({
        teacherId: teacher.id,
        teacherLabel,
        segmentId: segment.id,
        segmentName: segment.name,
        columns: [column],
        blocks: buildBlocks(buildRowPlan(segment), [column], cellFor),
      })
    }
  }

  return exports
}
