# E11 — Native Data Portability

**Status**: in-review

## Goal

Let the full application state — every entity, constraint, Schedule
Version, manual edit, and note — be exported to a single file and
re-imported, on the same or a different computer, to fully restore it.

## Spec references

- **FR-23** — full-state export/import.
- **TR-6** — data is single-machine/single-profile; portability is exclusively via this file.
- **TR-7** — single downloadable file, round-trips fully.
- **TR-8** — versioned schema, forward migration for older files, rejection for newer ones.
- **TR-12** — native format is structured (JSON), not meant for hand-editing.

## Human verification

1. Configure a non-trivial school state (entities + at least one Schedule
   Version with a manual edit and a note) and export it to a file.
2. Import that file into a fresh browser profile (or after clearing site
   data); confirm the state is fully restored, including the Schedule
   Version, the edit, and the note.
3. Construct (or hand-edit for test purposes) a file with an older
   `schemaVersion` and confirm it's migrated forward automatically on
   import.
4. Construct a file with a newer `schemaVersion` than the app supports and
   confirm import is rejected with a clear pt-BR error, not a silent
   best-effort load.

## Tasks

| ID | Task | Status |
|---|---|---|
| E11-T1 | Export: serialize entities store + schedule-versions store into one JSON file with a top-level `schemaVersion` (FR-23, TR-7, TR-12) | done |
| E11-T2 | Import: parse the file and load it into both stores in full, replacing current state (FR-23) | done |
| E11-T3 | Migration chain: one pure function per schema version step, applied in order for older files (TR-8) | done |
| E11-T4 | Reject newer-than-supported `schemaVersion` files with a clear pt-BR error (TR-8) | done |
| E11-T5 | Unit tests for each migration function in isolation (TR-11) | done |

## Decisions

- See [D-34](../DECISIONS.md) — export/import lives on its own "Dados"
  screen, with both a file download/upload path and a visible,
  copy/pasteable JSON textarea (the latter not explicitly required by
  FR-23/TR-7, added for support/debugging convenience).
- Import is destructive (replaces all current data) and gated behind a
  native `confirm()` prompt — not literally required by FR-23 but a
  reasonable safety net for an otherwise-irreversible action from the UI.

## Notes

- No migration functions exist yet — `schemaVersion 1` is the first shape
  this app has ever exported, so `persistence/migrations.ts`'s chain is
  currently empty (E11-T3/T5 are satisfied by the chain-runner mechanism
  itself being tested; the first real `migrateV1ToV2`-style function gets
  its own tests when it's actually needed).
- Agent-driven verification (Vite dev server + headless Chromium via
  Playwright): seeded data through the real UI (not IndexedDB injection),
  exported, cleared IndexedDB to simulate a fresh profile, imported the
  exported JSON via the paste-text path, confirmed the data was fully
  restored and persisted across a reload, and confirmed a `schemaVersion`
  newer than this build supports is rejected with the correct pt-BR
  message. No console errors. This is agent-driven verification, not the
  epic's own Human Verification steps — those still need a person to walk
  them before this epic moves to `done`.
