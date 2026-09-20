# E08 — Views: Per-Class & Per-Teacher

**Status**: new

## Goal

Let the user actually look at a saved Schedule Version — as a weekly grid
per Class, and as a weekly grid per Teacher.

## Spec references

- **FR-20** — Per-Class view, each period shows Subject + Teacher.
- **FR-21** — Per-Teacher view, each period shows Class + Subject, across every class taught.
- **TR-19** — reached via in-app state/tabs, no URL router.

## Human verification

1. Open the active Schedule Version's Per-Class view for a specific Class;
   confirm every occupied period shows both Subject and Teacher.
2. Open the Per-Teacher view for a specific Teacher; confirm their full week
   across every Class they teach is visible, each period showing Class and
   Subject.
3. Switch between views without a page reload/URL change (TR-19).

## Tasks

| ID | Task | Status |
|---|---|---|
| E08-T1 | Per-Class weekly grid view component (FR-20) | new |
| E08-T2 | Per-Teacher weekly grid view component (FR-21) | new |
| E08-T3 | In-app navigation between views/entities (state-driven, no router per TR-19) | new |

## Decisions

*(none yet)*

## Notes

*(none)*
