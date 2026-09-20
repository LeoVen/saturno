// Pure helpers for "HH:MM" 24h clock times (TR-11 pattern: pure, unit-tested
// logic, kept independent of any store/UI code).

import type { ClockTime } from './segment'

/** Zero-padded "HH:MM" strings compare correctly as plain strings. */
export function isValidRange(start: ClockTime, end: ClockTime): boolean {
  return start.length > 0 && end.length > 0 && start < end
}

/** Sorts a copy of `items` chronologically by `start` (ordering for FR-5's "ordered set"). */
export function sortByStart<T extends { start: ClockTime }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.start.localeCompare(b.start))
}
