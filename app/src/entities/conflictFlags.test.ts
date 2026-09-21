import { describe, expect, it } from 'vitest'
import { conflictMessagesByCell } from './conflictFlags'
import type { PlacedPeriod, Violation } from '../wasm/types'

describe('conflictMessagesByCell', () => {
  it('flags the exact cell for a ClassDoubleBooked violation', () => {
    const placements: PlacedPeriod[] = [
      { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', subjectId: 's-2', teacherId: 't-2', weekday: 'tue', timeSlotId: 'ts-2' },
    ]
    const violations: Violation[] = [
      {
        type: 'classDoubleBooked',
        classId: 'c-1',
        weekday: 'mon',
        timeSlotId: 'ts-1',
        message: 'conflito',
      },
    ]
    const result = conflictMessagesByCell(violations, placements)
    expect(result.get('mon:ts-1')).toEqual(['conflito'])
    expect(result.has('tue:ts-2')).toBe(false)
  })

  it('flags every placement of the affected Teacher that weekday for TeacherDoubleBooked (no exact overlap info)', () => {
    const placements: PlacedPeriod[] = [
      { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-2', subjectId: 's-2', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-2' },
      { classId: 'c-3', subjectId: 's-3', teacherId: 't-1', weekday: 'tue', timeSlotId: 'ts-1' },
    ]
    const violations: Violation[] = [
      { type: 'teacherDoubleBooked', teacherId: 't-1', weekday: 'mon', message: 'x' },
    ]
    const result = conflictMessagesByCell(violations, placements)
    expect(result.has('mon:ts-1')).toBe(true)
    expect(result.has('mon:ts-2')).toBe(true)
    expect(result.has('tue:ts-1')).toBe(false)
  })

  it('collects multiple messages on the same cell', () => {
    const placements: PlacedPeriod[] = [
      { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
    ]
    const violations: Violation[] = [
      {
        type: 'classDoubleBooked',
        classId: 'c-1',
        weekday: 'mon',
        timeSlotId: 'ts-1',
        message: 'a',
      },
      { type: 'teacherDoubleBooked', teacherId: 't-1', weekday: 'mon', message: 'b' },
    ]
    const result = conflictMessagesByCell(violations, placements)
    expect(result.get('mon:ts-1')).toEqual(['a', 'b'])
  })

  it('returns an empty map when nothing applies', () => {
    const placements: PlacedPeriod[] = [
      { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
    ]
    const violations: Violation[] = [
      { type: 'teacherDoubleBooked', teacherId: 't-2', weekday: 'mon', message: 'x' },
    ]
    expect(conflictMessagesByCell(violations, placements).size).toBe(0)
  })
})
