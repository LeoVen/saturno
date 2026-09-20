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
