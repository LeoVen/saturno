# E11 — Native Data Portability

**Status**: new

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
| E11-T1 | Export: serialize entities store + schedule-versions store into one JSON file with a top-level `schemaVersion` (FR-23, TR-7, TR-12) | new |
| E11-T2 | Import: parse the file and load it into both stores in full, replacing current state (FR-23) | new |
| E11-T3 | Migration chain: one pure function per schema version step, applied in order for older files (TR-8) | new |
| E11-T4 | Reject newer-than-supported `schemaVersion` files with a clear pt-BR error (TR-8) | new |
| E11-T5 | Unit tests for each migration function in isolation (TR-11) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
