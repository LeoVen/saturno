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

/** Full pt-BR day names ("Segunda-feira"), matching the real sample sheets' day-header convention (IMPL.md §9) — used only by the Human-Readable Export, not the on-screen grids. */
export const WEEKDAY_LABELS_FULL: Record<Weekday, string> = {
  mon: 'Segunda-feira',
  tue: 'Terça-feira',
  wed: 'Quarta-feira',
  thu: 'Quinta-feira',
  fri: 'Sexta-feira',
}

/** FR-22/TR-13: the paper-oriented "two days per row" pairing — (Mon,Tue), (Wed,Thu), (Fri alone), matching every real sample sheet in `sheets/`. */
export const WEEKDAY_EXPORT_PAIRS: Weekday[][] = [['mon', 'tue'], ['wed', 'thu'], ['fri']]

/** Sorts a copy of `items` by weekday (Mon..Fri), then chronologically within a day. */
export function sortByWeekdayThenStart<T extends { weekday: Weekday; start: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const dayDiff = WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday)
    return dayDiff !== 0 ? dayDiff : a.start.localeCompare(b.start)
  })
}
