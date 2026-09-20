# E07 — Schedule Versions

**Status**: in-review

## Goal

Give a generated schedule a persistent home: the user can name it, hold
several versions at once, switch between them, and duplicate one as a
starting point for a new one. This is what Views (E08) and Manual Editing
(E09) will read from and write to.

## Spec references

- **FR-24** — named Schedule Versions; switch; duplicate.
- **TR-5** — schedule-versions store, distinct from the entities store (IMPL.md §7).

## Human verification

1. Generate a schedule (E06) and save it as a named version (e.g. "2026").
2. Create a second version by duplicating the first; rename it (e.g.
   "2026 - rascunho"); confirm both exist independently.
3. Switch between the two versions and confirm each shows its own state.
4. Reload the browser and confirm both versions persisted.

## Tasks

| ID | Task | Status |
|---|---|---|
| E07-T1 | Schedule Version entity: name, the Schedule itself, created/duplicated-from metadata (FR-24) | done |
| E07-T2 | "Save as new version" action, wired to E06's Generate output | done |
| E07-T3 | Duplicate an existing version as a new one (FR-24) | done |
| E07-T4 | Switch the active version (FR-24) | done |
| E07-T5 | Wire persistence into the schedule-versions store, kept separate from the entities store (TR-5, IMPL.md §7) | done |

## Decisions

- See [D-23](../DECISIONS.md) — a duplicated version defaults to "{name}
  (cópia)" and becomes active immediately; the user renames it afterward
  rather than being prompted for a name up front.

## Notes

- `ScheduleGrid.vue` was factored out of E06's `GenerateView.vue` (the
  per-Class weekly grid, now takes a `schedule` prop) so both the
  just-generated result and a saved Schedule Version render the same way —
  avoids duplicating that logic between "Gerar Horário" and "Versões".
- Agent-driven verification (Vite dev server + headless Chromium via
  Playwright, entities/school config seeded directly into IndexedDB):
  generated a schedule, saved it as version "2026", duplicated it, renamed
  the copy to "2026 - rascunho", switched the active version back to
  "2026" (confirmed the grid's heading updated), reloaded the browser, and
  confirmed both versions and the active-version selection persisted. No
  console errors. This is agent-driven verification, not the epic's own
  Human Verification steps — those still need a person to walk them before
  this epic moves to `done`.
