# E07 — Schedule Versions

**Status**: new

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
| E07-T1 | Schedule Version entity: name, the Schedule itself, created/duplicated-from metadata (FR-24) | new |
| E07-T2 | "Save as new version" action, wired to E06's Generate output | new |
| E07-T3 | Duplicate an existing version as a new one (FR-24) | new |
| E07-T4 | Switch the active version (FR-24) | new |
| E07-T5 | Wire persistence into the schedule-versions store, kept separate from the entities store (TR-5, IMPL.md §7) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
