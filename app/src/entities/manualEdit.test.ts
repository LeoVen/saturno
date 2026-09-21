import { describe, expect, it } from 'vitest'
import { movePlacement } from './manualEdit'
import type { Schedule } from '../wasm/types'

describe('movePlacement', () => {
  it('moves a placement into an empty slot, leaving the origin empty', () => {
    const schedule: Schedule = {
      placements: [
        { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
      ],
    }
    const result = movePlacement(
      schedule,
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', weekday: 'tue', timeSlotId: 'ts-2' },
    )
    expect(result?.changed).toBe(true)
    expect(result?.schedule.placements).toEqual([
      { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'tue', timeSlotId: 'ts-2' },
    ])
  })

  it('swaps two placements when the target slot is already occupied', () => {
    const schedule: Schedule = {
      placements: [
        {
          classId: 'c-1',
          subjectId: 's-math',
          teacherId: 't-1',
          weekday: 'mon',
          timeSlotId: 'ts-1',
        },
        {
          classId: 'c-1',
          subjectId: 's-port',
          teacherId: 't-2',
          weekday: 'tue',
          timeSlotId: 'ts-2',
        },
      ],
    }
    const result = movePlacement(
      schedule,
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', weekday: 'tue', timeSlotId: 'ts-2' },
    )
    expect(result?.changed).toBe(true)
    expect(result?.schedule.placements).toEqual([
      { classId: 'c-1', subjectId: 's-math', teacherId: 't-1', weekday: 'tue', timeSlotId: 'ts-2' },
      { classId: 'c-1', subjectId: 's-port', teacherId: 't-2', weekday: 'mon', timeSlotId: 'ts-1' },
    ])
  })

  it('only touches the given Class, leaving other Classes at the same real slot untouched', () => {
    const schedule: Schedule = {
      placements: [
        { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
        { classId: 'c-2', subjectId: 's-2', teacherId: 't-2', weekday: 'tue', timeSlotId: 'ts-2' },
      ],
    }
    const result = movePlacement(
      schedule,
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', weekday: 'tue', timeSlotId: 'ts-2' },
    )
    expect(result?.schedule.placements).toContainEqual({
      classId: 'c-2',
      subjectId: 's-2',
      teacherId: 't-2',
      weekday: 'tue',
      timeSlotId: 'ts-2',
    })
  })

  it('returns null when the origin slot has no placement', () => {
    const schedule: Schedule = { placements: [] }
    const result = movePlacement(
      schedule,
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', weekday: 'tue', timeSlotId: 'ts-2' },
    )
    expect(result).toBeNull()
  })

  it('is a no-op (changed: false) when the target is the same slot as the origin', () => {
    const schedule: Schedule = {
      placements: [
        { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
      ],
    }
    const result = movePlacement(
      schedule,
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
    )
    expect(result).toEqual({ schedule, changed: false })
  })

  it('does not mutate the input Schedule', () => {
    const schedule: Schedule = {
      placements: [
        { classId: 'c-1', subjectId: 's-1', teacherId: 't-1', weekday: 'mon', timeSlotId: 'ts-1' },
      ],
    }
    const frozen = JSON.parse(JSON.stringify(schedule))
    movePlacement(
      schedule,
      { classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
      { classId: 'c-1', weekday: 'tue', timeSlotId: 'ts-2' },
    )
    expect(schedule).toEqual(frozen)
  })
})
