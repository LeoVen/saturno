# E02 — Segments, Time Slots & Breaks

**Status**: done

## Goal

Let a school define its top-level Segments (e.g. Ensino Fundamental, Ensino
Médio), each with its own ordered Time Slots and Break periods — the
foundation every other entity (Grade, Class, Teacher availability) is
configured against.

## Spec references

- **FR-4** — Segments.
- **FR-5** — per-Segment Time Slots and Breaks, including multiple breaks per day.

## Human verification

1. Create two Segments (e.g. "Ensino Fundamental", "Ensino Médio").
2. Give EF one break (09:30–10:00) and EM two breaks (08:40–08:55,
   10:35–10:50), matching the example in `specs/PRD.md` §1/prd-v1.md.
3. Reload the browser and confirm both Segments' full configuration
   (time slots, breaks) persisted exactly.

## Tasks

| ID | Task | Status |
|---|---|---|
| E02-T1 | Segment entity: create/edit/delete (name) | done |
| E02-T2 | Time Slot entity: per-Segment ordered list, start/end (24h) | done |
| E02-T3 | Break entity: per-Segment, start/end, supports multiple per day | done |
| E02-T4 | Config UI: manage one Segment's Time Slots and Breaks together | done |
| E02-T5 | Wire persistence for Segment/Time Slot/Break (TR-5) | done |

## Decisions

- See [D-02](../DECISIONS.md) — a Segment's daily period/break structure is
  fixed across all weekdays (one structure per Segment, not per weekday).
- See [D-01](../DECISIONS.md) — Time Slots must expose real, absolute
  start/end clock times (not just a per-Segment period index), since Teacher
  conflict-checking (E06) compares actual time overlaps across Segments.
- See [D-07](../DECISIONS.md) — Time Slots/Breaks are auto-sorted by start
  time; no manual reorder UI.
- See [D-08](../DECISIONS.md) — entity IDs via `crypto.randomUUID()`.
- See [D-09](../DECISIONS.md) — E01's throwaway scaffolding UI (WASM ping,
  `scaffoldCheck` store) removed, replaced by this epic's real UI.

## Notes

- Implementation: `app/src/entities/segment.ts` (types), `app/src/entities/time.ts`
  (pure `isValidRange`/`sortByStart` helpers, unit-tested), `app/src/stores/entities.ts`
  (the Pinia "entities store" per IMPL.md §7 — Segment/Time Slot/Break CRUD;
  later epics add Grades/Classes/Subjects/Teachers/etc. to this same store),
  `app/src/components/SegmentsConfig.vue` (UI, mounted from `App.vue`).
- Validation is intentionally minimal here: a Time Slot/Break add or edit is
  rejected if `start >= end`. Cross-entry checks (overlapping periods, a
  weekly-load feasibility warning, etc.) are FR-13's territory, scoped to E05
  — not duplicated here.
- **Verification performed by the agent** (2026-09-20): full unit suite
  (`npm test`, 15 tests across `entities.test.ts`/`time.test.ts`) passes; `npm run lint`,
  `npm run format`, and `npm run build` (`vue-tsc -b && vite build`) are all
  clean. Additionally drove the real app end-to-end with a headless
  Playwright browser against `npm run dev`: created a Segment, added a Time
  Slot (08:00–08:50) and a Break (09:30–10:00), reloaded the page, and
  confirmed both persisted with exact values via IndexedDB — no console
  errors. This exercises the same steps as the epic's Human Verification
  list but was not run by an actual human — per `PROCESS.md` §4/§6, E02-T5
  and the epic itself stay `in-review` until a human walks through the
  Human Verification steps above (ideally with two Segments, EF/EM, matching
  the PRD example exactly) and flips them to `done`.
- **Human verification confirmed** (2026-09-20): user reviewed and signed
  off ("looks good to me"). E02-T5 and the epic moved to `done`.
