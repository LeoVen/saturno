# E03 — Grades, Classes & Subjects

**Status**: done

## Goal

Let a school define its Grades (year/level) within a Segment, the Classes
(sections) within each Grade, and a global Subject catalog — the units the
solver ultimately builds a schedule for.

## Spec references

- **FR-6** — Grade belongs to one Segment; Class belongs to one Grade and is the actual schedulable unit.
- **FR-7** — global Subject catalog.

## Human verification

1. Under the "Ensino Fundamental" Segment, create Grade "7º Ano" with two
   Classes: "7º Ano A" and "7º Ano B", matching the real example in
   `sheets/HorárioEF_24.08.2026_T1.xlsx`.
2. Create a Subject catalog entry (e.g. "História").
3. Reload the browser and confirm everything persisted, with Classes
   correctly nested under their Grade and Segment.

## Tasks

| ID | Task | Status |
|---|---|---|
| E03-T1 | Grade entity: create/edit/delete, belongs to exactly one Segment (FR-6) | done |
| E03-T2 | Class entity: create/edit/delete, belongs to exactly one Grade (FR-6) | done |
| E03-T3 | Subject entity: global catalog, create/edit/delete (FR-7) | done |
| E03-T4 | Config UI: Grades/Classes nested under their Segment | done |
| E03-T5 | Config UI: global Subject catalog | done |
| E03-T6 | Wire persistence for Grade/Class/Subject (TR-5) | done |

## Decisions

- See [D-08](../DECISIONS.md) — entity IDs via `crypto.randomUUID()` (E02
  precedent, followed here for Grade/Class/Subject too).

## Notes

- Implementation: `app/src/entities/grade.ts`, `class.ts`, `subject.ts`
  (types); `app/src/stores/entities.ts` extended with flat `grades`/
  `classes`/`subjects` arrays (referencing their parent by id — unlike Time
  Slots/Breaks, which are embedded in their Segment, Grades/Classes/Subjects
  are kept as separate top-level arrays since later epics — E04 Teacher
  availability, E05 requirements — reference a Class or Subject directly by
  id); `app/src/components/GradesClassesConfig.vue` (Grades nested under the
  Segment selected in `SegmentsConfig.vue` — selection lifted to `App.vue`
  and shared via `v-model`/prop) and `SubjectsConfig.vue` (flat global
  catalog, no parent).
- Cascade deletes: removing a Segment removes its Grades and their Classes;
  removing a Grade removes its Classes. `addGrade`/`addClass` reject a
  nonexistent parent id (return `undefined`), same pattern as E02's
  `addTimeSlot`/`addBreak` rejecting an invalid range.
- **Verification performed by the agent** (2026-09-20): full unit suite
  (`npm test`, 22 tests, up from 15 — 7 new covering Grades/Classes/Subjects
  CRUD and cascade deletes) passes; `npm run lint`, `npm run format`, and
  `npm run build` are all clean. Also drove the real app end-to-end with a
  headless Playwright browser against `npm run dev`: created a Segment, a
  Grade ("7º Ano") with two Classes ("7º Ano A"/"7º Ano B"), and a Subject
  ("História") — matching this epic's Human Verification steps and the real
  `sheets/HorárioEF_24.08.2026_T1.xlsx` example — then reloaded and
  confirmed everything persisted with Classes correctly nested under their
  Grade/Segment, no console errors. Per `PROCESS.md` §4/§6, E03-T6 and the
  epic itself stay `in-review` until a human actually walks through the
  Human Verification steps and flips them to `done`.
- **Human verification confirmed** (2026-09-20): user reviewed and signed
  off ("looks good to me"). E03-T6 and the epic moved to `done`.
