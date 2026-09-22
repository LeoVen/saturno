import { describe, expect, it } from 'vitest'
import { buildClassGridExports, buildTeacherGridExports } from './scheduleExport'
import type { EntitiesSnapshot } from '../persistence/exportImport'
import type { ScheduleNote } from '../entities/scheduleVersion'
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

describe('buildClassGridExports', () => {
  it('lays out one block per (Mon,Tue)/(Wed,Thu)/(Fri) pair, with the Break as its own divider row', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-1',
          name: 'Ensino Fundamental',
          timeSlots: [
            { id: 'ts-1', start: '07:00', end: '07:50' },
            { id: 'ts-2', start: '08:00', end: '08:50' },
          ],
          breaks: [{ id: 'b-1', start: '07:50', end: '08:00' }],
        },
      ],
      grades: [{ id: 'g-1', segmentId: 'seg-1', name: '6º Ano' }],
      classes: [{ id: 'c-1', gradeId: 'g-1', name: 'A' }],
      subjects: [{ id: 'sub-1', name: 'Matemática' }],
      teachers: [{ id: 't-1', name: 'Ana', unavailability: [], subjectIds: [] }],
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
      ],
    }

    const [grid] = buildClassGridExports(entities, schedule)
    expect(grid!.segmentName).toBe('Ensino Fundamental')
    expect(grid!.columns).toEqual([{ key: 'c-1', label: '6º Ano A' }])
    expect(grid!.blocks).toHaveLength(3)
    expect(grid!.blocks[0]!.days.map((d) => d.weekday)).toEqual(['mon', 'tue'])
    expect(grid!.blocks[2]!.days.map((d) => d.weekday)).toEqual(['fri'])

    const [row1, breakRow, row2] = grid!.blocks[0]!.rows
    expect(row1!.kind).toBe('period')
    expect(breakRow!.kind).toBe('break')
    expect(row2!.kind).toBe('period')

    // Monday (day 0) has the placement; Tuesday (day 1) is empty.
    expect(row1!.cellsByDay[0]![0]).toEqual({ lines: ['Ana', 'Matemática'] })
    expect(row1!.cellsByDay[1]![0]).toBeNull()
    // The Break row carries no cell content on either day.
    expect(breakRow!.cellsByDay[0]![0]).toBeNull()
    expect(breakRow!.cellsByDay[1]![0]).toBeNull()
  })

  it('does not leak a placement into a different Segment that happens to share a clock time (the TeacherScheduleGrid regression)', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-ef',
          name: 'Ensino Fundamental',
          timeSlots: [{ id: 'ts-ef', start: '07:00', end: '07:50' }],
          breaks: [],
        },
        {
          id: 'seg-em',
          name: 'Ensino Medio',
          timeSlots: [{ id: 'ts-em', start: '07:00', end: '07:50' }],
          breaks: [],
        },
      ],
      grades: [
        { id: 'g-ef', segmentId: 'seg-ef', name: '6º Ano' },
        { id: 'g-em', segmentId: 'seg-em', name: '1ª Série' },
      ],
      classes: [
        { id: 'c-ef', gradeId: 'g-ef', name: 'A' },
        { id: 'c-em', gradeId: 'g-em', name: 'A' },
      ],
      subjects: [{ id: 'sub-1', name: 'Português' }],
      teachers: [{ id: 't-1', name: 'Mara', unavailability: [], subjectIds: [] }],
    })
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-em',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-em',
        },
      ],
    }

    const [efGrid, emGrid] = buildClassGridExports(entities, schedule)
    const efCell = efGrid!.blocks[0]!.rows[0]!.cellsByDay[0]![0]
    const emCell = emGrid!.blocks[0]!.rows[0]!.cellsByDay[0]![0]
    expect(efCell).toBeNull()
    expect(emCell).toEqual({ lines: ['Mara', 'Português'] })
  })
})

describe('Notes footnotes + reference markers (FR-19, IMPL.md §9)', () => {
  function makeTwoClassEntities(): EntitiesSnapshot {
    return makeEntities({
      segments: [
        {
          id: 'seg-1',
          name: 'Ensino Fundamental',
          timeSlots: [{ id: 'ts-1', start: '07:00', end: '07:50' }],
          breaks: [],
        },
      ],
      grades: [{ id: 'g-1', segmentId: 'seg-1', name: '6º Ano' }],
      classes: [
        { id: 'c-1', gradeId: 'g-1', name: 'A' },
        { id: 'c-2', gradeId: 'g-1', name: 'B' },
      ],
      subjects: [{ id: 'sub-1', name: 'Matemática' }],
      teachers: [{ id: 't-1', name: 'Ana', unavailability: [], subjectIds: [] }],
    })
  }

  const schedule: Schedule = {
    placements: [
      { classId: 'c-1', subjectId: 'sub-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
    ],
  }

  it('numbers whole-schedule and slot Notes together, in order, attaching a noteNumber to the matching cell — including a slot with no placement', () => {
    const notes: ScheduleNote[] = [
      { id: 'n-whole', text: 'Nota geral', createdAt: '2026-01-01T00:00:00Z' },
      {
        id: 'n-slot',
        text: 'Nota da aula',
        createdAt: '2026-01-02T00:00:00Z',
        slot: { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      },
      {
        id: 'n-empty-slot',
        text: 'Nota em horário vago',
        createdAt: '2026-01-03T00:00:00Z',
        slot: { classId: 'c-2', weekday: 'mon', timeSlotId: 'ts-1' },
      },
    ]

    const [grid] = buildClassGridExports(makeTwoClassEntities(), schedule, notes)

    expect(grid!.footnotes).toEqual([
      { number: 1, text: 'Nota geral' },
      { number: 2, text: 'Nota da aula' },
      { number: 3, text: 'Nota em horário vago' },
    ])

    const row = grid!.blocks[0]!.rows[0]!
    expect(row.cellsByDay[0]![0]).toEqual({ lines: ['Ana', 'Matemática'], noteNumber: 2 })
    // c-2's slot has no placement but does have a Note — still rendered, not null.
    expect(row.cellsByDay[0]![1]).toEqual({ lines: [], noteNumber: 3 })
  })

  it('omits a slot Note attached to a Class outside this grid, and does not number it', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-ef',
          name: 'Ensino Fundamental',
          timeSlots: [{ id: 'ts-ef', start: '07:00', end: '07:50' }],
          breaks: [],
        },
        {
          id: 'seg-em',
          name: 'Ensino Medio',
          timeSlots: [{ id: 'ts-em', start: '07:00', end: '07:50' }],
          breaks: [],
        },
      ],
      grades: [
        { id: 'g-ef', segmentId: 'seg-ef', name: '6º Ano' },
        { id: 'g-em', segmentId: 'seg-em', name: '1ª Série' },
      ],
      classes: [
        { id: 'c-ef', gradeId: 'g-ef', name: 'A' },
        { id: 'c-em', gradeId: 'g-em', name: 'A' },
      ],
      subjects: [{ id: 'sub-1', name: 'Português' }],
      teachers: [{ id: 't-1', name: 'Mara', unavailability: [], subjectIds: [] }],
    })
    const notes: ScheduleNote[] = [
      {
        id: 'n-em',
        text: 'Nota do EM',
        createdAt: '2026-01-01T00:00:00Z',
        slot: { classId: 'c-em', weekday: 'mon', timeSlotId: 'ts-em' },
      },
    ]

    const [efGrid, emGrid] = buildClassGridExports(entities, { placements: [] }, notes)
    expect(efGrid!.footnotes).toEqual([])
    expect(emGrid!.footnotes).toEqual([{ number: 1, text: 'Nota do EM' }])
  })

  it("numbers a Note on the Teacher grid only when it matches that Teacher's own placement, never an empty-slot Note (no Teacher to attach it to)", () => {
    const entities = makeTwoClassEntities()
    const notes: ScheduleNote[] = [
      {
        id: 'n-slot',
        text: 'Nota da aula',
        createdAt: '2026-01-01T00:00:00Z',
        slot: { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      },
      {
        id: 'n-empty-slot',
        text: 'Nota em horário vago',
        createdAt: '2026-01-02T00:00:00Z',
        slot: { classId: 'c-2', weekday: 'mon', timeSlotId: 'ts-1' },
      },
    ]

    const [grid] = buildTeacherGridExports(entities, schedule, notes)
    expect(grid!.footnotes).toEqual([{ number: 1, text: 'Nota da aula' }])
    expect(grid!.blocks[0]!.rows[0]!.cellsByDay[0]![0]).toEqual({
      lines: ['6º Ano A', 'Matemática'],
      noteNumber: 1,
    })
  })
})

describe('buildTeacherGridExports', () => {
  it('produces one grid per (Teacher, Segment), with Class + Subject per cell', () => {
    const entities = makeEntities({
      segments: [
        {
          id: 'seg-ef',
          name: 'Ensino Fundamental',
          timeSlots: [{ id: 'ts-ef', start: '07:00', end: '07:50' }],
          breaks: [],
        },
        {
          id: 'seg-em',
          name: 'Ensino Medio',
          timeSlots: [{ id: 'ts-em', start: '10:50', end: '11:40' }],
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
      subjects: [{ id: 'sub-geo1', name: 'Geografia 1' }],
      teachers: [{ id: 't-1', name: 'Fernando', unavailability: [], subjectIds: [] }],
    })
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-ef',
          subjectId: 'sub-geo1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-ef',
        },
        {
          classId: 'c-em',
          subjectId: 'sub-geo1',
          teacherId: 't-1',
          weekday: 'tue',
          timeSlotId: 'ts-em',
        },
      ],
    }

    const grids = buildTeacherGridExports(entities, schedule)
    expect(grids).toHaveLength(2)
    expect(grids.map((g) => g.segmentName).sort()).toEqual(['Ensino Fundamental', 'Ensino Medio'])

    const efGrid = grids.find((g) => g.segmentId === 'seg-ef')!
    expect(efGrid.teacherLabel).toBe('Fernando')
    expect(efGrid.blocks[0]!.rows[0]!.cellsByDay[0]![0]).toEqual({
      lines: ['6º Ano A', 'Geografia 1'],
    })
  })

  it('omits a Teacher with no placements at all', () => {
    const entities = makeEntities({
      teachers: [{ id: 't-1', name: 'Sem Aulas', unavailability: [], subjectIds: [] }],
    })
    const grids = buildTeacherGridExports(entities, { placements: [] })
    expect(grids).toHaveLength(0)
  })
})
