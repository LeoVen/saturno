import { describe, expect, it } from 'vitest'
import {
  distinctSortedRanges,
  hourlyPeriods,
  isValidRange,
  rangesOverlap,
  sortByStart,
  subtractRange,
} from './time'

describe('isValidRange', () => {
  it('accepts a start strictly before end', () => {
    expect(isValidRange('08:00', '08:50')).toBe(true)
  })

  it('rejects equal start and end', () => {
    expect(isValidRange('08:00', '08:00')).toBe(false)
  })

  it('rejects a start after end', () => {
    expect(isValidRange('09:00', '08:00')).toBe(false)
  })

  it('rejects empty values', () => {
    expect(isValidRange('', '08:00')).toBe(false)
    expect(isValidRange('08:00', '')).toBe(false)
  })
})

describe('sortByStart', () => {
  it('orders items chronologically by start time', () => {
    const items = [{ start: '10:35' }, { start: '08:00' }, { start: '09:30' }]
    expect(sortByStart(items).map((i) => i.start)).toEqual(['08:00', '09:30', '10:35'])
  })

  it('does not mutate the input array', () => {
    const items = [{ start: '10:00' }, { start: '08:00' }]
    const sorted = sortByStart(items)
    expect(sorted).not.toBe(items)
    expect(items[0]?.start).toBe('10:00')
  })
})

describe('rangesOverlap', () => {
  it('detects a partial overlap', () => {
    expect(rangesOverlap('08:00', '09:00', '08:30', '09:30')).toBe(true)
  })

  it('detects one range fully containing the other', () => {
    expect(rangesOverlap('08:00', '12:00', '09:00', '10:00')).toBe(true)
  })

  it('treats touching (back-to-back) ranges as not overlapping', () => {
    expect(rangesOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false)
  })

  it('detects no overlap for disjoint ranges', () => {
    expect(rangesOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false)
  })
})

describe('subtractRange', () => {
  it('returns the range unchanged when the cut does not overlap it', () => {
    const range = { start: '08:00', end: '09:00' }
    expect(subtractRange(range, { start: '10:00', end: '11:00' })).toEqual([range])
  })

  it('removes the range entirely when the cut fully covers it', () => {
    const range = { start: '08:00', end: '09:00' }
    expect(subtractRange(range, { start: '07:00', end: '10:00' })).toEqual([])
  })

  it('trims the tail when the cut overlaps the end', () => {
    const range = { start: '08:00', end: '10:00' }
    expect(subtractRange(range, { start: '09:00', end: '11:00' })).toEqual([
      { start: '08:00', end: '09:00' },
    ])
  })

  it('trims the head when the cut overlaps the start', () => {
    const range = { start: '08:00', end: '10:00' }
    expect(subtractRange(range, { start: '07:00', end: '09:00' })).toEqual([
      { start: '09:00', end: '10:00' },
    ])
  })

  it('splits into two pieces when the cut is strictly inside the range', () => {
    const range = { start: '08:00', end: '12:00' }
    expect(subtractRange(range, { start: '09:00', end: '10:00' })).toEqual([
      { start: '08:00', end: '09:00' },
      { start: '10:00', end: '12:00' },
    ])
  })

  it('preserves extra fields on the pieces it returns', () => {
    const range = { start: '08:00', end: '12:00', id: 'r1' }
    expect(subtractRange(range, { start: '09:00', end: '10:00' })).toEqual([
      { start: '08:00', end: '09:00', id: 'r1' },
      { start: '10:00', end: '12:00', id: 'r1' },
    ])
  })
})

describe('distinctSortedRanges', () => {
  it('sorts and removes exact duplicates', () => {
    const ranges = [
      { start: '09:00', end: '09:50' },
      { start: '08:00', end: '08:50' },
      { start: '08:00', end: '08:50' },
    ]
    expect(distinctSortedRanges(ranges)).toEqual([
      { start: '08:00', end: '08:50' },
      { start: '09:00', end: '09:50' },
    ])
  })

  it('keeps ranges that overlap but are not exact duplicates', () => {
    const ranges = [
      { start: '08:00', end: '08:50' },
      { start: '08:00', end: '09:00' },
    ]
    expect(distinctSortedRanges(ranges)).toHaveLength(2)
  })
})

describe('hourlyPeriods', () => {
  it('generates one-hour periods across the given range', () => {
    expect(hourlyPeriods(7, 10)).toEqual([
      { start: '07:00', end: '08:00' },
      { start: '08:00', end: '09:00' },
      { start: '09:00', end: '10:00' },
    ])
  })
})
