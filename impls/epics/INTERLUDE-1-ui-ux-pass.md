# INTERLUDE-1 — UI/UX Pass

**Status**: in-review

## Goal

Rework the config screens built in E02–E05 (Segmentos, Séries e Turmas,
Disciplinas, Professores, Atribuições) into a properly navigable, visually
coherent app: persistent section navigation instead of one long scrolling
page, a real fixed-24h time input, a calendar-style weekly grid for entering
Time Slots/Breaks and Teacher Availability, a small shared design system,
and removal of implementation-detail leaks (raw ids, undecoded values) from
user-facing text. No new functional requirements — a quality pass over what
already exists, confirmed directly with the user, 2026-09-20.

## Spec references

None directly — this epic implements no new FR. Standing constraints it
must respect: **TR-14/TR-15** (browser targets, no phone layout — already a
constraint on every UI epic) and **TR-19** (no URL router — navigation
between sections is in-app reactive state, not routed). See
[D-14](../DECISIONS.md) for what an "interlude" epic is and why it's
numbered outside the E&lt;NN&gt; sequence.

## Human verification

1. Open the app; confirm Segmentos / Séries e Turmas / Disciplinas /
   Professores / Atribuições are reachable via a persistent left sidebar
   (not one long scrolling page), and switching between sections doesn't
   lose already-entered data.
2. Configure a Segment's Time Slots and Breaks using the new weekly grid;
   confirm the result is the same underlying data as before (real absolute
   clock times per D-01/D-02) and reads clearly at a glance.
3. Enter a time value anywhere in the app (e.g. a new Time Slot); confirm
   it's always presented and entered in 24h HH:MM — no AM/PM anywhere,
   regardless of OS/browser locale.
4. Configure a Teacher's availability using the new weekly grid; confirm a
   partial, non-whole-day exception ("unavailable Tuesday afternoons," per
   FR-3's own example) is still expressible and reads clearly.
5. Create two Teachers named identically; confirm they're still visibly
   distinguishable in every list/picker without exposing a raw internal id.
6. Re-run E02–E05's original Human Verification steps end-to-end once more
   through the reworked UI; confirm every one still holds — this epic
   changes presentation of existing screens, not the data model.

## Tasks

| ID | Task | Status |
|---|---|---|
| INTERLUDE-1-T1 | Navigation shell: persistent left sidebar switching between the 5 existing sections, as in-app reactive state (no router, TR-19) | done |
| INTERLUDE-1-T2 | Design system pass: light-only base stylesheet (palette, type scale, spacing) + shared button/input/card/table styles, replacing each component's ad hoc scoped CSS | done |
| INTERLUDE-1-T3 | `TimeInput` component: fixed 24h HH:MM (hour + 5-minute-step minute selects), replacing every native `<input type="time">` | done |
| INTERLUDE-1-T4 | `WeekGrid` component: reusable weekday × time-row grid, click-to-toggle cells, as a visual layer over the existing data model (no data-model changes) | done |
| INTERLUDE-1-T5 | Apply `WeekGrid` to Segment Time Slot/Break configuration | done |
| INTERLUDE-1-T6 | Apply `WeekGrid` to Teacher Availability configuration | done |
| INTERLUDE-1-T7 | Remove implementation-detail leaks: same-name-Teacher disambiguation without a raw id, decode Assignment's consecutive-periods value into its label everywhere it's shown, audit remaining screens for similar leaks | done |
| INTERLUDE-1-T8 | Regression pass: re-verify E02–E05's Human Verification steps through the reworked UI | in-review |

## Decisions

- See [D-14](../DECISIONS.md) — what an "interlude" epic is, why it's
  numbered outside the E&lt;NN&gt; sequence.
- See [D-15](../DECISIONS.md) — `WeekGrid` is a visual layer only; Teacher
  Availability's grid rows are derived from the union of all configured
  Segments' Time Slot boundaries, not a new fixed granularity.
- See [D-16](../DECISIONS.md) — `TimeInput` is always 24h, 5-minute steps;
  native `<input type="time">` dropped everywhere (confirmed rendering
  AM/PM in E02–E05's own verification screenshots — a real bug, not a
  hypothetical one).
- See [D-17](../DECISIONS.md) — same-name Teacher disambiguation drops the
  raw id badge for a display-only ordinal, computed at render time.

## Notes

- Confirmed with the user (2026-09-20): sidebar navigation over tabs
  (section count will keep growing past what tabs comfortably hold);
  `WeekGrid` interaction is click-to-toggle for v1, not drag-to-select
  (real calendar-style drag is more engineering/edge cases than a
  desktop-only config tool needs right now — revisit later if click-toggle
  feels too slow in practice).
- Explicitly out of scope: DEFERRED.md's "default set of Subjects" item —
  that's a data-seeding feature, not UI/UX, and wasn't part of what the
  user described for this epic. Left in `DEFERRED.md` for a future pass.
- This epic touches shared components used by every prior epic's screens,
  which is exactly why T8 (regression pass) is a real task and not
  boilerplate — a nav/style/input-control rework is the kind of change
  that silently breaks something two epics back.
- Implementation: `app/src/style.css` (design tokens + shared utility
  classes: `.card`, `.btn`/`.btn-primary`/`.btn-danger`, `.input`,
  `.field`, `.pill-list`/`.pill`, `.table`, `.alert-danger`, `.sidebar`);
  `app/src/components/AppSidebar.vue` (nav shell, wired into `App.vue` via
  a plain `activeSection` ref — no router); `TimeInput.vue` (hour/minute
  `<select>` pair, `allowEmpty` for "not yet chosen"); `WeekGrid.vue` (a
  pure layout primitive — columns/rows in, a `#cell` scoped slot out; no
  business logic of its own, per its own file comment on why Segments and
  Teacher Availability need different interaction models over the same
  visual skeleton). `GradesClassesConfig.vue` now owns its own Segment
  picker instead of taking a `segmentId` prop from `App.vue` — each nav
  section is self-contained.
  New pure helpers backing WeekGrid: `subtractRange`/`distinctSortedRanges`/
  `hourlyPeriods` in `entities/time.ts` (unit-tested); new store action
  `setAvailability` (click-to-toggle for Teacher Availability — correctly
  trims/splits whatever range(s) already cover a clicked cell, not just an
  exact-match range) and getter `availabilityGridPeriods` (D-15's merged
  Segment boundaries, hourly fallback); new getter `teacherLabel` (D-17's
  disambiguated display name, used everywhere a Teacher is shown by name).
- Segments/Breaks are rendered as a single-column WeekGrid "timeline"
  (colored blocks, click "Remover"), not a real 5-day grid — periods are
  identical across weekdays per D-02, so there's nothing for extra columns
  to show. Teacher Availability is the one genuine 5-column weekly grid.
- **Verification performed by the agent** (2026-09-20): full unit suite
  (`npm test`, 77 tests, up from 58 — 19 new covering the new time-range
  helpers, `setAvailability`'s trim/split behavior, `availabilityGridPeriods`,
  and `teacherLabel`) passes; `npm run lint`, `npm run format`, and
  `npm run build` are all clean. Drove the real app end-to-end with a
  headless Playwright browser re-running E02–E05's original Human
  Verification steps through the reworked UI in one continuous session
  (two Segments with the PRD's exact break times, Grades/Classes/Subjects,
  two same-name Teachers with a Tuesday-afternoon unavailability set via
  the click-to-toggle grid, an Assignment with a double period + the
  3-period ceiling confirmed structurally absent from the dropdown, a
  Teacher limit, an overload warning, reload) — every check passed, no
  console errors at any point, and the same-name Teachers rendered as
  "Guilherme (1)"/"Guilherme (2)" with no raw id anywhere. Screenshots
  confirm the visual result: sidebar nav, card-based layout, real 24h time
  selects (no AM/PM), and the availability grid's cells turning red on
  click. Per `PROCESS.md` §4/§6, T8 and the epic itself stay `in-review`
  until a human walks through the Human Verification steps above and flips
  them to `done`.
