import { describe, expect, it } from 'vitest'
import { buildClassGridWorkbook, buildTeacherGridWorkbook } from './xlsxExport'
import { buildClassGridExports, buildTeacherGridExports } from './scheduleExport'
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
  ],
}

describe('buildClassGridWorkbook', () => {
  it("produces one sheet per Segment, with the day-banner merged across that day block's columns", () => {
    const entities = makeEntities()
    const grids = buildClassGridExports(entities, schedule)
    const workbook = buildClassGridWorkbook(grids)

    // E15: plus one hidden re-import manifest sheet (xlsxManifest.test.ts covers its content).
    expect(workbook.worksheets).toHaveLength(2)
    const sheet = workbook.getWorksheet('Ensino Fundamental')!
    expect(sheet).toBeDefined()

    // Row 1: day banner. Monday's own Horário column (A) is blank-filled;
    // "Segunda-feira" is merged across just its two Class columns (B1:C1).
    // Tuesday's group starts at D — its own Horário column (D) is blank, and
    // "Terça-feira" is merged across its own Class columns (E1:F1).
    expect(sheet.getCell('B1').value).toBe('Segunda-feira')
    expect(sheet.getCell('B1').isMerged).toBe(true)
    expect(sheet.getCell('C1').isMerged).toBe(true)
    expect(sheet.getCell('E1').value).toBe('Terça-feira')
    expect(sheet.getCell('E1').isMerged).toBe(true)
    expect(sheet.getCell('F1').isMerged).toBe(true)

    // Row 2: header — "Horário" + the two Class labels, once per day
    // (user request 2026-09-21: repeat "Horário" for the second day too).
    expect(sheet.getCell('A2').value).toBe('Horário')
    expect(sheet.getCell('B2').value).toBe('6º Ano A')
    expect(sheet.getCell('C2').value).toBe('6º Ano B')
    expect(sheet.getCell('D2').value).toBe('Horário')
    expect(sheet.getCell('E2').value).toBe('6º Ano A')
    expect(sheet.getCell('F2').value).toBe('6º Ano B')

    // Row 3: first Time Slot — the Monday placement lands in column B (Class A),
    // Teacher (Ana) as the bigger/bold primary line, Subject smaller beneath it.
    // Tuesday's Horário column (D) repeats the same time label.
    expect(sheet.getCell('A3').value).toBe('07:00–07:50')
    const b3 = sheet.getCell('B3').value as { richText: { font: object; text: string }[] }
    expect(b3.richText).toEqual([
      { font: { size: 12, bold: true }, text: 'Ana' },
      { font: { size: 9, color: { argb: 'FF666666' } }, text: '\nMatemática' },
    ])
    expect(sheet.getCell('C3').value).toBeNull()
    expect(sheet.getCell('D3').value).toBe('07:00–07:50')
    expect(sheet.getCell('E3').value).toBeNull()

    // Row 4: the Break — filled, no value, on both days' Horário columns.
    expect(sheet.getCell('A4').value).toBe('07:50–08:00')
    expect(sheet.getCell('B4').value).toBeNull()
    expect(sheet.getCell('D4').value).toBe('07:50–08:00')
    const fill = sheet.getCell('A4').fill
    expect(fill.type === 'pattern' && fill.fgColor?.argb).toBe('FFBFDBFE')
  })

  it("sizes every day-block's columns the same, not just the first day's, and each day's own Horário column at the narrower time-column width", () => {
    const entities = makeEntities()
    const grids = buildClassGridExports(entities, schedule)
    const workbook = buildClassGridWorkbook(grids)
    const sheet = workbook.getWorksheet('Ensino Fundamental')!

    // Monday: Horário (A), Class A/B (B/C). Tuesday: Horário (D), Class A/B (E/F).
    expect(sheet.getColumn(1).width).toBe(14) // Monday, Horário
    expect(sheet.getColumn(2).width).toBe(18) // Monday, Class A
    expect(sheet.getColumn(3).width).toBe(18) // Monday, Class B
    expect(sheet.getColumn(4).width).toBe(14) // Tuesday, Horário
    expect(sheet.getColumn(5).width).toBe(18) // Tuesday, Class A
    expect(sheet.getColumn(6).width).toBe(18) // Tuesday, Class B
  })
})

describe('buildTeacherGridWorkbook', () => {
  it('produces one sheet per (Teacher, Segment), de-duplicating sheet names', () => {
    const entities = makeEntities()
    const grids = buildTeacherGridExports(entities, schedule)
    const workbook = buildTeacherGridWorkbook(grids)

    expect(workbook.worksheets).toHaveLength(1)
    expect(workbook.worksheets[0]!.name).toBe('Ana - Ensino Fundamental')
    expect(workbook.getWorksheet('Ana - Ensino Fundamental')!.getCell('B2').value).toBe('Ana')
  })
})
