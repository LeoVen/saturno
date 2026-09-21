import { describe, expect, it } from 'vitest'
import { buildTeacherScheduleGrid } from './teacherSchedule'
import type { EntitiesSnapshot } from '../persistence/exportImport'
import type { Schedule } from '../wasm/types'

function makeEntities(overrides: Partial<EntitiesSnapshot> = {}): EntitiesSnapshot {
  return {
    segments: [],
    grades: [],
    classes: [],
    subjects: [],
    teachers: [],
    assignments: [],
    ...overrides,
  }
}

describe('buildTeacherScheduleGrid', () => {
  it('returns null for a Teacher with no placements at all', () => {
    const entities = makeEntities()
    const result = buildTeacherScheduleGrid(entities, { placements: [] }, 't-1')
    expect(result).toBeNull()
  })

  it('single-Segment Teacher: one segment name, no gaps for back-to-back periods', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-1',
          name: 'Ensino Fundamental',
          timeSlots: [
            { id: 'ts-1', start: '07:00', end: '07:50' },
            { id: 'ts-2', start: '07:50', end: '08:40' },
          ],
          breaks: [],
        },
      ],
      grades: [{ id: 'g-1', segmentId: 'seg-1', name: '6º Ano' }],
      classes: [{ id: 'c-1', gradeId: 'g-1', name: 'A' }],
      subjects: [{ id: 'sub-1', name: 'Matemática' }],
    })
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-1',
        },
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-2',
        },
      ],
    }

    const grid = buildTeacherScheduleGrid(entities, schedule, 't-1')!
    expect(grid.segmentNames).toEqual(['Ensino Fundamental'])
    expect(grid.rows).toHaveLength(2)
    expect(grid.cells.get('mon:07:00-07:50')).toEqual({
      kind: 'occupied',
      classLabel: '6º Ano A',
      subject: 'Matemática',
    })
    expect(grid.cells.get('mon:07:50-08:40')).toEqual({
      kind: 'occupied',
      classLabel: '6º Ano A',
      subject: 'Matemática',
    })
  })

  it('multi-Segment Teacher: merges into one grid and flags the real idle gap between Segments', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-ef',
          name: 'Ensino Fundamental',
          timeSlots: [{ id: 'ts-ef', start: '08:40', end: '09:30' }],
          breaks: [],
        },
        {
          id: 'seg-em',
          name: 'Ensino Medio',
          timeSlots: [{ id: 'ts-em', start: '09:45', end: '10:35' }],
          breaks: [],
        },
      ],
      grades: [
        { id: 'g-ef', segmentId: 'seg-ef', name: '6º Ano' },
        { id: 'g-em', segmentId: 'seg-em', name: '9º Ano' },
      ],
      classes: [
        { id: 'c-ef', gradeId: 'g-ef', name: 'A' },
        { id: 'c-em', gradeId: 'g-em', name: 'A' },
      ],
      subjects: [{ id: 'sub-geo', name: 'Geografia' }],
    })
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-ef',
          subjectId: 'sub-geo',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-ef',
        },
        {
          classId: 'c-em',
          subjectId: 'sub-geo',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-em',
        },
      ],
    }

    const grid = buildTeacherScheduleGrid(entities, schedule, 't-1')!
    expect(grid.segmentNames.sort()).toEqual(['Ensino Fundamental', 'Ensino Medio'])
    // One merged grid, not two separate tables: both Time Slots are rows here.
    expect(grid.rows.map((r) => r.key)).toEqual(['08:40-09:30', '09:45-10:35'])
    expect(grid.cells.get('mon:08:40-09:30')?.kind).toBe('occupied')
    expect(grid.cells.get('mon:09:45-10:35')?.kind).toBe('occupied')
    // No row exists for the 09:30-09:45 window itself (no Segment defines
    // it) — the gap is visible as the numbers not lining up between rows,
    // not as a separate row.
    expect(grid.rows.some((r) => r.key === '09:30-09:45')).toBe(false)
  })

  it('flags an unoccupied period within the day span as a gap, not as empty', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-1',
          name: 'Ensino Fundamental',
          timeSlots: [
            { id: 'ts-1', start: '07:00', end: '07:50' },
            { id: 'ts-2', start: '07:50', end: '08:40' },
            { id: 'ts-3', start: '08:40', end: '09:30' },
          ],
          breaks: [],
        },
      ],
      grades: [{ id: 'g-1', segmentId: 'seg-1', name: '6º Ano' }],
      classes: [{ id: 'c-1', gradeId: 'g-1', name: 'A' }],
      subjects: [{ id: 'sub-1', name: 'Matemática' }],
    })
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-1',
        },
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-3',
        },
      ],
    }

    const grid = buildTeacherScheduleGrid(entities, schedule, 't-1')!
    expect(grid.cells.get('mon:07:00-07:50')?.kind).toBe('occupied')
    expect(grid.cells.get('mon:07:50-08:40')).toEqual({ kind: 'gap' })
    expect(grid.cells.get('mon:08:40-09:30')?.kind).toBe('occupied')
  })

  it('leaves a weekday with no placements entirely empty (no gap cells before the first or after the last commitment)', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-1',
          name: 'Ensino Fundamental',
          timeSlots: [
            { id: 'ts-1', start: '07:00', end: '07:50' },
            { id: 'ts-2', start: '07:50', end: '08:40' },
          ],
          breaks: [],
        },
      ],
      grades: [{ id: 'g-1', segmentId: 'seg-1', name: '6º Ano' }],
      classes: [{ id: 'c-1', gradeId: 'g-1', name: 'A' }],
      subjects: [{ id: 'sub-1', name: 'Matemática' }],
    })
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-2',
        },
      ],
    }

    const grid = buildTeacherScheduleGrid(entities, schedule, 't-1')!
    expect(grid.cells.has('mon:07:00-07:50')).toBe(false)
    expect(grid.cells.get('mon:07:50-08:40')?.kind).toBe('occupied')
    expect(grid.cells.has('tue:07:00-07:50')).toBe(false)
    expect(grid.cells.has('tue:07:50-08:40')).toBe(false)
  })
})
