import { describe, expect, it } from 'vitest'
import { sortByWeekdayThenStart } from './weekday'

describe('sortByWeekdayThenStart', () => {
  it('orders by weekday first, then start time within a day', () => {
    const items = [
      { weekday: 'wed' as const, start: '08:00' },
      { weekday: 'mon' as const, start: '14:00' },
      { weekday: 'mon' as const, start: '09:00' },
    ]

    expect(sortByWeekdayThenStart(items)).toEqual([
      { weekday: 'mon', start: '09:00' },
      { weekday: 'mon', start: '14:00' },
      { weekday: 'wed', start: '08:00' },
    ])
  })

  it('does not mutate the input array', () => {
    const items = [
      { weekday: 'fri' as const, start: '08:00' },
      { weekday: 'mon' as const, start: '08:00' },
    ]
    const sorted = sortByWeekdayThenStart(items)
    expect(sorted).not.toBe(items)
    expect(items[0]?.weekday).toBe('fri')
  })
})
