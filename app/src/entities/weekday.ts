// The school week modeled in Saturno is Monday–Friday (D-10: matches TR-10's
// "5-day weeks" scale assumption and every real sample sheet in `sheets/`).

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

export type Weekday = (typeof WEEKDAYS)[number]

/** pt-BR (FR-1) display labels, shared by every weekly-grid component. */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
}

/** Sorts a copy of `items` by weekday (Mon..Fri), then chronologically within a day. */
export function sortByWeekdayThenStart<T extends { weekday: Weekday; start: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const dayDiff = WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday)
    return dayDiff !== 0 ? dayDiff : a.start.localeCompare(b.start)
  })
}
