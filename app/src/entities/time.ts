// Pure helpers for "HH:MM" 24h clock times (TR-11 pattern: pure, unit-tested
// logic, kept independent of any store/UI code).

/** 24h clock time, "HH:MM" (zero-padded), as produced by <input type="time">. */
export type ClockTime = string

/** Zero-padded "HH:MM" strings compare correctly as plain strings. */
export function isValidRange(start: ClockTime, end: ClockTime): boolean {
  return start.length > 0 && end.length > 0 && start < end
}

/** Sorts a copy of `items` chronologically by `start` (ordering for FR-5's "ordered set"). */
export function sortByStart<T extends { start: ClockTime }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.start.localeCompare(b.start))
}

/** Whether [aStart, aEnd) and [bStart, bEnd) overlap at all (used by FR-13's availability check). */
export function rangesOverlap(
  aStart: ClockTime,
  aEnd: ClockTime,
  bStart: ClockTime,
  bEnd: ClockTime,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

export interface TimeRangeValue {
  start: ClockTime
  end: ClockTime
}

/**
 * Removes `cut` from `range`, returning the 0, 1, or 2 pieces of `range`
 * left over (used by WeekGrid's click-to-toggle: clicking an "unavailable"
 * cell off must correctly trim/split whatever range(s) currently cover it,
 * not just delete a range that happens to match the cell exactly).
 */
export function subtractRange<T extends TimeRangeValue>(range: T, cut: TimeRangeValue): T[] {
  if (!rangesOverlap(range.start, range.end, cut.start, cut.end)) return [range]
  const pieces: T[] = []
  if (range.start < cut.start) pieces.push({ ...range, end: cut.start })
  if (cut.end < range.end) pieces.push({ ...range, start: cut.end })
  return pieces
}

/** A plain hourly grid, e.g. hourlyPeriods(7, 19) -> 07:00-08:00, 08:00-09:00, ..., 18:00-19:00. */
export function hourlyPeriods(startHour: number, endHour: number): TimeRangeValue[] {
  const periods: TimeRangeValue[] = []
  for (let h = startHour; h < endHour; h++) {
    periods.push({
      start: `${String(h).padStart(2, '0')}:00`,
      end: `${String(h + 1).padStart(2, '0')}:00`,
    })
  }
  return periods
}

/** Sorted, de-duplicated (by exact start+end) list of ranges — e.g. Time Slots merged across several Segments. */
export function distinctSortedRanges<T extends TimeRangeValue>(ranges: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const range of sortByStart(ranges)) {
    const key = `${range.start}-${range.end}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(range)
  }
  return result
}
