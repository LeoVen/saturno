# E02 — Segments, Time Slots & Breaks

**Status**: new

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
| E02-T1 | Segment entity: create/edit/delete (name) | new |
| E02-T2 | Time Slot entity: per-Segment ordered list, start/end (24h) | new |
| E02-T3 | Break entity: per-Segment, start/end, supports multiple per day | new |
| E02-T4 | Config UI: manage one Segment's Time Slots and Breaks together | new |
| E02-T5 | Wire persistence for Segment/Time Slot/Break (TR-5) | new |

## Decisions

- See [D-02](../DECISIONS.md) — a Segment's daily period/break structure is
  fixed across all weekdays (one structure per Segment, not per weekday).
- See [D-01](../DECISIONS.md) — Time Slots must expose real, absolute
  start/end clock times (not just a per-Segment period index), since Teacher
  conflict-checking (E06) compares actual time overlaps across Segments.

## Notes

*(none further — both open questions originally noted here were resolved;
see Decisions above.)*
