import { describe, expect, it } from 'vitest'
import { isValidRange, sortByStart } from './time'

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
