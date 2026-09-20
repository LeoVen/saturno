import { describe, expect, it } from 'vitest'
import {
  allWeeklyPeriods,
  findOverloadedClasses,
  findZeroOverlapAssignments,
  type AssignmentAvailabilityCheck,
} from './validation'

describe('findOverloadedClasses', () => {
  it('flags a Class whose required weekly load exceeds its available periods', () => {
    const loads = [
      { classId: 'over', requiredWeekly: 30, availableWeekly: 25 },
      { classId: 'fits', requiredWeekly: 20, availableWeekly: 25 },
      { classId: 'exact', requiredWeekly: 25, availableWeekly: 25 },
    ]

    expect(findOverloadedClasses(loads).map((l) => l.classId)).toEqual(['over'])
  })

  it('returns nothing when every Class fits', () => {
    expect(
      findOverloadedClasses([{ classId: 'a', requiredWeekly: 10, availableWeekly: 25 }]),
    ).toEqual([])
  })
})

describe('allWeeklyPeriods', () => {
  it("expands a Segment's Time Slots across all 5 weekdays", () => {
    const periods = allWeeklyPeriods([
      { start: '08:00', end: '08:50' },
      { start: '08:50', end: '09:40' },
    ])
    expect(periods).toHaveLength(10)
    expect(periods.filter((p) => p.weekday === 'mon')).toHaveLength(2)
    expect(periods.filter((p) => p.weekday === 'fri')).toHaveLength(2)
  })
})

describe('findZeroOverlapAssignments', () => {
  it("flags an Assignment whose Teacher is unavailable for every one of the Class's periods", () => {
    const checks: AssignmentAvailabilityCheck[] = [
      {
        assignmentId: 'a1',
        teacherId: 't1',
        classId: 'c1',
        classPeriods: [
          { weekday: 'mon', start: '08:00', end: '08:50' },
          { weekday: 'tue', start: '08:00', end: '08:50' },
        ],
        unavailability: [
          { weekday: 'mon', start: '07:00', end: '12:00' },
          { weekday: 'tue', start: '07:00', end: '12:00' },
        ],
      },
    ]

    expect(findZeroOverlapAssignments(checks)).toEqual([
      { assignmentId: 'a1', teacherId: 't1', classId: 'c1' },
    ])
  })

  it('does not flag an Assignment with at least one free period', () => {
    const checks: AssignmentAvailabilityCheck[] = [
      {
        assignmentId: 'a1',
        teacherId: 't1',
        classId: 'c1',
        classPeriods: [
          { weekday: 'mon', start: '08:00', end: '08:50' },
          { weekday: 'tue', start: '08:00', end: '08:50' },
        ],
        unavailability: [{ weekday: 'mon', start: '07:00', end: '12:00' }],
      },
    ]

    expect(findZeroOverlapAssignments(checks)).toEqual([])
  })

  it('does not flag an Assignment with no unavailability at all', () => {
    const checks: AssignmentAvailabilityCheck[] = [
      {
        assignmentId: 'a1',
        teacherId: 't1',
        classId: 'c1',
        classPeriods: [{ weekday: 'mon', start: '08:00', end: '08:50' }],
        unavailability: [],
      },
    ]

    expect(findZeroOverlapAssignments(checks)).toEqual([])
  })

  it('does not flag an Assignment for a Class with no periods configured', () => {
    const checks: AssignmentAvailabilityCheck[] = [
      {
        assignmentId: 'a1',
        teacherId: 't1',
        classId: 'c1',
        classPeriods: [],
        unavailability: [{ weekday: 'mon', start: '00:00', end: '23:59' }],
      },
    ]

    expect(findZeroOverlapAssignments(checks)).toEqual([])
  })
})
