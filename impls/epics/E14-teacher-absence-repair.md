# E14 — Teacher Absence & Repair

**Status**: new

## Goal

Let the user mark a Teacher absent for part or all of a specific day, and
trigger a narrow repair that fills only the vacated slot(s) — using another
Teacher already configured for that (Class, Subject) — while leaving every
other assignment untouched.

## Spec references

- **FR-35** — one-off Absence override (distinct from recurring Availability); vacates affected slot(s) immediately.
- **FR-36** — repair fills vacated slots using an already-configured (Class, Subject) Teacher who's available; everything else untouched.
- **FR-37** — unfillable slots reported specifically, not left silently empty.
- **TR-16** — reuses the same Verifier/hard-constraint model; main thread, no Worker pool, near-instant.
- **IMPL.md §4.4** (`repair`), **§5.6** (repair mode detail).

## Human verification

1. Mark a Teacher absent for specific periods on a specific day (not their
   full recurring Availability — that stays unchanged).
2. Confirm the affected Class slot(s) become vacant immediately in the
   active Schedule Version.
3. Trigger Repair; confirm any slot with another qualified, available
   Teacher (already linked to that Class/Subject per FR-9) gets filled,
   while every other assignment in the schedule is bit-for-bit unchanged.
4. Construct a case where no substitute is configured/available for a
   vacated slot; confirm it's reported as specifically unfillable, not
   silently left blank or blocking the rest of the repair.

## Tasks

| ID | Task | Status |
|---|---|---|
| E14-T1 | Absence entity: Teacher + day + affected period(s), separate from recurring Availability (FR-35) | new |
| E14-T2 | Marking an Absence vacates the corresponding slot(s) in the active Schedule Version (FR-35) | new |
| E14-T3 | Implement `repair(input, schedule, absence) -> RepairResult` in Rust: candidate search restricted to already-configured (Class, Subject) Teachers, filtered by availability and non-conflict with the unmodified rest of the schedule (FR-36, IMPL.md §5.6) | new |
| E14-T4 | Bipartite matching across multiple vacated slots in one absence (IMPL.md §5.6) | new |
| E14-T5 | Surface `RepairResult.unfillable` slots specifically in the UI (FR-37) | new |
| E14-T6 | Wire Repair to run synchronously on the main thread, no Worker pool (TR-16) | new |
| E14-T7 | Unit tests: repair never touches an unaffected slot; unfillable slots are reported, not silently dropped (TR-11) | new |

## Decisions

*(none yet)*

## Notes

*(none)*

## Future consideration: constrained re-solve after a Manual Edit (not yet in scope)

**Status: an unconfirmed idea, not a requirement.** Raised by the user
while reviewing E09 (2026-09-21) — see [D-39](../DECISIONS.md) for the
screen-reorg decision this came out of. Not FR-35–37 (which stay exactly
as specified below) and not a task on this epic's list — recorded here,
pinned to this epic, because it's the closest existing concept and the
natural epic to fold it into *if* it's ever confirmed and scoped for
real. Needs its own "confirmed with user" pass (PRD.md §4-style) before
it becomes an FR.

**The idea**: after manually rearranging some placements ("Ajustar
Horário", E09/D-39), let the user trigger a solver-assisted fix-up that
resolves whatever Hard-Constraint conflicts the rearrangement introduced,
by relocating the *other*, non-arranged placements involved — never the
ones the user just deliberately moved. Currently, FR-17/18 stop at
flagging the conflict; the user is on their own to fix it by hand.

**Why it's related to Repair, not a new thing from scratch**: §5.6's
`repair` is already exactly this shape — "hold the rest of the schedule
fixed, search for a feasible reassignment of a specific problem set,
reusing the Constructor's constraint-checking logic, never running the
Refiner/Scorer." Absence-Repair is one instantiation of that general
primitive:

| | Absence-Repair (FR-35–37, as specified) | Manual-Edit-Repair (this idea) |
|---|---|---|
| Problem set | slot(s) the absence vacated | placement(s) `verify` currently flags, minus whatever the user just manually touched |
| Fixed/pinned | everything else | everything else, *including* the user's manual arrangement |
| Candidate axis | alternate Teacher only (day/time/Class/Subject fixed) | alternate day/time (and possibly Teacher) for the *other* conflicting placement |
| Trigger | marking an Absence | a conflict flag existing after a manual edit |

A shared Rust primitive — "given a Schedule, a problem set of
placements, and a pinned set to hold fixed, search for a feasible
reassignment of the problem set only" — could plausibly serve both,
rather than building two separate constrained-search implementations.
Whether that shared shape actually holds once both are speced in detail
is exactly the kind of thing a real design pass needs to check, not
assume from this sketch.

**Open questions a real scoping pass would need to resolve** (not
answered here):
- **Telling "just arranged, must stay put" apart from "was already
  conflict-free, also shouldn't move"**: `conflictFlags.ts`'s existing
  mapping (E09) identifies *which* placements a violation touches, but
  when a conflict involves exactly two placements (e.g. a
  `TeacherDoubleBooked` between the user's moved placement and some
  pre-existing one), something has to break the tie toward relocating
  the *other* one, not the user's pick. Candidates: track a `pinned`
  marker on any placement `movePlacement` touches (new bookkeeping,
  precise); or simplify to a per-run heuristic — everything the user
  moved *this session* is protected, everything else flagged is
  fair game (simpler, but "this session" is a fuzzy boundary once
  drafts persist across reloads).
- **Candidate axis for Manual-Edit-Repair**: Absence-Repair only ever
  searches for an alternate *Teacher* (the slot's day/time/Class/Subject
  are fixed by definition — the absence didn't move anything). A
  conflict from a manual edit more often needs an alternate *day/time*
  for the displaced placement (same Teacher, same Subject, same Class —
  just moved out of the way) — a materially different search than
  Absence-Repair's teacher-substitution. Whether one Rust function can
  cleanly cover both candidate axes, or whether they end up as two
  related-but-separate functions sharing only the
  hold-the-rest-fixed-and-check-Hard-Constraints core, is open.
- **Partial success semantics**: FR-37 already defines "unfillable →
  reported, not blocking" for Absence-Repair. Whether the same framing
  fits a manual-edit fix-up (report what *couldn't* be resolved, leave
  the conflict flagged as today) needs the same confirm-with-user
  treatment the rest of this table got in PRD.md §4.
- **Where this lives in the UI**: the user's proposal was a shared
  "Ajustar Horário" section hosting both Manual Editing (E09) and this
  epic (E14) once both exist, since both are "modify a saved schedule,
  reconcile the consequences." No UI built for that pairing yet — E09's
  `AdjustScheduleView.vue` has no Absence/Repair section, stubbed or
  otherwise, per "don't build for a hypothetical future requirement."
