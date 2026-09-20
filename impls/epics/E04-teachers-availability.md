# E04 — Teachers & Availability

**Status**: done

## Goal

Let a school create Teacher records — including same-name teachers as
distinct entities — and define each Teacher's recurring weekly availability.

## Spec references

- **FR-2** — Teacher entity; names not unique.
- **FR-3** — recurring weekly day × time availability grid (not whole-day/partial-day toggle).
- Builds on **[D-01](../DECISIONS.md)** — availability is modeled as time ranges per day, independent of any one Segment's period grid, since a Teacher can teach across Segments.

## Human verification

1. Create two Teacher records both named "Guilherme"; confirm both exist as
   distinct entities (e.g. distinguishable in a list even with identical
   names).
2. Set one Teacher unavailable only Tuesday afternoons — a partial,
   non-whole-day pattern, per FR-3's example.
3. Reload the browser and confirm both Teachers and their availability
   persisted correctly.

## Tasks

| ID | Task | Status |
|---|---|---|
| E04-T1 | Teacher entity: create/edit/delete, name (duplicates allowed, disambiguated internally) (FR-2) | done |
| E04-T2 | Weekly Availability model: day × time-range grid, stored independent of any Segment's period structure per D-01 (FR-3) | done |
| E04-T3 | Config UI: Teacher list | done |
| E04-T4 | Config UI: availability grid editor for one Teacher | done |
| E04-T5 | Wire persistence for Teacher/Availability (TR-5) | done |

## Decisions

- See [D-01](../DECISIONS.md) — Availability is time-range-based, not tied
  to a specific Segment's periods.
- See [D-10](../DECISIONS.md) — school week is fixed Monday–Friday.
- See [D-11](../DECISIONS.md) — availability defaults to fully available;
  the user records `UnavailabilityRange` exceptions, not opt-in periods.

## Notes

- Implementation: `app/src/entities/weekday.ts` (`Weekday`/`WEEKDAYS`, plus
  the pure `sortByWeekdayThenStart` helper, unit-tested), `app/src/entities/teacher.ts`
  (`Teacher`/`UnavailabilityRange` types), `app/src/stores/entities.ts`
  extended with Teacher CRUD and `addUnavailability`/`updateUnavailability`/
  `removeUnavailability` (same invalid-range rejection pattern as E02's Time
  Slots/Breaks), `app/src/components/TeachersConfig.vue` (Teacher list +
  five-weekday-column availability editor for the selected Teacher).
  `ClockTime` moved from `entities/segment.ts` into `entities/time.ts` (it's
  a general time-domain type, not Segment-specific — `segment.ts` now
  imports it back).
  Same-name Teachers are disambiguated in the list by a short id suffix
  (`#xxxx`, first 4 hex chars of the UUID) shown next to the name — cheap
  and satisfies this epic's Human Verification #1 directly.
- **Bug caught and fixed during agent verification**: the initial CSS for
  the day-column availability grid let a range row (two time inputs +
  "Remover") overflow its ~160px column and visually bleed into the next
  day's column once a range was added (only visible once a real range was
  rendered — easy to miss without actually driving the UI). Fixed by
  widening the grid's minimum column width (160px → 230px), letting a range
  row wrap (`flex-wrap: wrap`), and letting the time inputs shrink
  (`flex: 1 1 6.5em`). Confirmed fixed via a follow-up screenshot.
- **Verification performed by the agent** (2026-09-20): full unit suite
  (`npm test`, 32 tests, up from 22 — 10 new covering Teacher CRUD,
  same-name distinctness, and Unavailability add/update/remove/sort/
  rejection) passes; `npm run lint`, `npm run format`, and `npm run build`
  are all clean. Also drove the real app end-to-end with a headless
  Playwright browser: created two Teachers both named "Guilherme" and
  confirmed they're visibly distinct in the list; set one unavailable only
  Tuesday 13:00–18:00 (a partial, non-whole-day pattern per FR-3); reloaded
  and confirmed both Teachers and the exact availability range persisted
  correctly, no console errors. This is exactly this epic's Human
  Verification list, but run by the agent, not an actual human — per
  `PROCESS.md` §4/§6, E04-T5 and the epic itself stay `in-review` until a
  human walks through the steps above and flips them to `done`.
- **Human verification confirmed** (2026-09-20): user reviewed and signed
  off ("looks good"). E04-T5 and the epic moved to `done`.
- **Retrofit** (2026-09-20): Teacher gained `subjectIds` (which Subjects it
  can teach) after this epic closed — see [D-25](../DECISIONS.md).
- **Retrofit** (2026-09-20): the Teachers list gained manual up/down
  reordering — see [D-26](../DECISIONS.md).
- **Retrofit** (2026-09-20): the Availability grid now shows one block per
  Segment instead of merging them into one flat row list — see
  [D-29](../DECISIONS.md).
- **Retrofit** (2026-09-20): a one-off "Ordenar por nome (A-Z)" bulk sort
  was added alongside the manual reorder buttons — see
  [D-30](../DECISIONS.md).
- **Retrofit** (2026-09-20): each weekday column got a "Bloquear dia"/
  "Liberar dia" toggle button — see [D-31](../DECISIONS.md).
