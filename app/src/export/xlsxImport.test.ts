import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildClassGridExports } from './scheduleExport'
import { buildClassGridWorkbook } from './xlsxExport'
import { importClassGridWorkbook } from './xlsxImport'
import type { EntitiesSnapshot } from '../persistence/exportImport'
import type { Schedule } from '../wasm/types'

function makeEntities(): EntitiesSnapshot {
  return {
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
    classes: [
      { id: 'c-1', gradeId: 'g-1', name: 'A' },
      { id: 'c-2', gradeId: 'g-1', name: 'B' },
    ],
    subjects: [{ id: 'sub-1', name: 'Matemática' }],
    teachers: [{ id: 't-1', name: 'Ana', unavailability: [], subjectIds: [] }],
    assignments: [],
  }
}

const schedule: Schedule = {
  placements: [
    { classId: 'c-1', subjectId: 'sub-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
    { classId: 'c-2', subjectId: 'sub-1', teacherId: 't-1', weekday: 'tue', timeSlotId: 'ts-2' },
  ],
}

function workbookFor(entities: EntitiesSnapshot, sched: Schedule): ExcelJS.Workbook {
  return buildClassGridWorkbook(buildClassGridExports(entities, sched))
}

describe('importClassGridWorkbook', () => {
  it('round-trips an unmodified export back to the same placements, through a full buffer save/load', async () => {
    const entities = makeEntities()
    const workbook = workbookFor(entities, schedule)
    const buffer = await workbook.xlsx.writeBuffer()
    const reloaded = new ExcelJS.Workbook()
    await reloaded.xlsx.load(buffer)

    const result = importClassGridWorkbook(reloaded, entities)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.schedule.placements).toHaveLength(2)
    expect(result.schedule.placements).toEqual(
      expect.arrayContaining([
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-1',
        },
        {
          classId: 'c-2',
          subjectId: 'sub-1',
          teacherId: 't-1',
          weekday: 'tue',
          timeSlotId: 'ts-2',
        },
      ]),
    )
  })

  it('treats a blank cell as "no placement" (a slot cleared in Excel)', () => {
    const entities = makeEntities()
    const workbook = workbookFor(entities, schedule)
    const sheet = workbook.getWorksheet('Ensino Fundamental')!
    sheet.getCell('B3').value = null // Monday, ts-1, Class A

    const result = importClassGridWorkbook(workbook, entities)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.schedule.placements).toHaveLength(1)
    expect(result.schedule.placements[0]!.classId).toBe('c-2')
  })

  it('resolves same-name Teachers via the "(N)" disambiguation suffix', () => {
    const entities = makeEntities()
    entities.teachers.push({ id: 't-2', name: 'Ana', unavailability: [], subjectIds: [] })
    const dupSchedule: Schedule = {
      placements: [
        {
          classId: 'c-1',
          subjectId: 'sub-1',
          teacherId: 't-2',
          weekday: 'mon',
          timeSlotId: 'ts-1',
        },
      ],
    }
    const workbook = workbookFor(entities, dupSchedule)
    const result = importClassGridWorkbook(workbook, entities)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.schedule.placements[0]!.teacherId).toBe('t-2')
  })

  it('fails the whole import (no partial result) when a cell names an unknown Teacher/Subject', () => {
    const entities = makeEntities()
    const workbook = workbookFor(entities, schedule)
    const sheet = workbook.getWorksheet('Ensino Fundamental')!
    sheet.getCell('B3').value = {
      richText: [
        { font: { size: 12, bold: true }, text: 'Alguém Que Não Existe' },
        { font: { size: 9 }, text: '\nMatemática' },
      ],
    }

    const result = importClassGridWorkbook(workbook, entities)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('B3')
  })

  it('rejects a file with no manifest sheet (not a Saturno "Por Turma" export)', () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Sheet1')
    const result = importClassGridWorkbook(workbook, makeEntities())
    expect(result.ok).toBe(false)
  })

  it('fails with a clear error when a manifest sheet was renamed or removed', () => {
    const entities = makeEntities()
    const workbook = workbookFor(entities, schedule)
    workbook.getWorksheet('Ensino Fundamental')!.name = 'Renomeada'
    const result = importClassGridWorkbook(workbook, entities)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain('Ensino Fundamental')
  })

  it('silently drops cells for a Class removed since export, without failing the import', () => {
    const entities = makeEntities()
    const workbook = workbookFor(entities, schedule)
    entities.classes = entities.classes.filter((c) => c.id !== 'c-2')

    const result = importClassGridWorkbook(workbook, entities)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.schedule.placements).toHaveLength(1)
    expect(result.schedule.placements[0]!.classId).toBe('c-1')
  })
})
