# E04 — Teachers & Availability

**Status**: new

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
| E04-T1 | Teacher entity: create/edit/delete, name (duplicates allowed, disambiguated internally) (FR-2) | new |
| E04-T2 | Weekly Availability model: day × time-range grid, stored independent of any Segment's period structure per D-01 (FR-3) | new |
| E04-T3 | Config UI: Teacher list | new |
| E04-T4 | Config UI: availability grid editor for one Teacher | new |
| E04-T5 | Wire persistence for Teacher/Availability (TR-5) | new |

## Decisions

- See [D-01](../DECISIONS.md) — Availability is time-range-based, not tied
  to a specific Segment's periods.

## Notes

*(none)*
