# E10 — Joint Sessions

**Status**: done

## Goal

Support shared multi-class periods (Ensino Médio "Itinerários"-style): a set
of Classes within one Segment released simultaneously into a block with
several parallel (Subject, Teacher) Tracks — without tracking any
individual-student data. Deferred until after core single-class scheduling
works end-to-end (config → generate → version → view → edit), per the
sequencing decision on `../BOARD.md`.

## Spec references

- **FR-25** — Joint Session: shared block, participating Classes all within one Segment.
- **FR-26** — no individual-student data tracked.
- **FR-27** — Tracks: (Subject, Teacher) pairs running in parallel.
- **FR-28** — weekly occurrence count for the session as a whole.
- **FR-29** — hard constraint: all participating Classes and Track Teachers simultaneously free, including against other Joint Sessions.
- **FR-30** — participation consumes weekly period budget but doesn't satisfy any (Class, Subject) requirement.
- **FR-31** — distinct display in Per-Class and Per-Teacher views.

## Human verification

1. Configure a Joint Session across multiple Classes/Grades within one
   Segment, with 2+ parallel Tracks — matching the Itinerários example in
   `sheets/HorárioEM_24.08.2026_T2.xlsx` (Ciências Humanas / Linguagens /
   Ciências da Natureza running in parallel).
2. Re-generate a schedule and confirm: the session occupies the same slot
   for every participating Class; no participating Class or Track Teacher is
   double-booked elsewhere at that time, including against another Joint
   Session.
3. Confirm the Joint Session's slot doesn't count toward any participating
   Class's individual (Class, Subject) weekly requirements (FR-30), but does
   count against its total weekly period budget (FR-13).
4. Confirm the Per-Class view labels the occurrence distinctly with the
   session's name, and the Per-Teacher view shows the specific Track that
   Teacher is booked into.

## Tasks

| ID | Task | Status |
|---|---|---|
| E10-T1 | Joint Session entity: name, participating Classes (validated same-Segment) (FR-25) | done |
| E10-T2 | Track entity: (Subject, Teacher) pairs within a Joint Session (FR-27) | done |
| E10-T3 | Weekly occurrence count config for the Joint Session as a whole (FR-28) | done |
| E10-T4 | Extend `verify`/Constructor: Joint Session hard constraints — all participating Classes and Track Teachers free, including against other Joint Sessions (FR-29) | done |
| E10-T5 | Ensure Joint Session participation consumes weekly budget without satisfying (Class, Subject) requirements; extend E05's FR-13 validation accordingly (FR-30) | done |
| E10-T6 | Extend Per-Class view: distinct Joint Session display, labeled by name (FR-31) | done |
| E10-T7 | Extend Per-Teacher view: show the specific Track booked (FR-31) | done |
| E10-T8 | Unit tests for the FR-29 constraint extension (TR-11) | done |

## Decisions

- See [D-40](../DECISIONS.md) — a Joint Session occurrence is tracked as
  its own `JointSessionPlacement` (a new `Schedule.jointSessionPlacements`
  array), not as N synthetic `PlacedPeriod`s — FR-30 means it has no
  single Subject/Teacher to attach to a Class-shaped placement, and this
  keeps "does this placement satisfy an FR-8 requirement" unambiguous
  (only real `placements` ever do).
- `jointSessions` (on `ScheduleInput`/`EntitiesSnapshot`) and
  `jointSessionPlacements` (on `Schedule`) are optional on the wire, same
  reasoning and precedent as `ScheduleVersion.notes` (E09) — absent on any
  data saved before this epic, always read as `?? []`.
- A Track has exactly one Teacher, not FR-9/D-12's substitute pool — FR-27
  never asked for one, and generalizing "one Teacher, rejected if already
  staffing another Track of the same session" to a pool wasn't needed for
  anything this epic actually does.
- Rejected a same-session duplicate Teacher across Tracks at the *data*
  layer (`addTrack`/`setTrackTeacher`), not just left for `verify` to
  flag — every Track in a session always runs at the identical slot(s)
  (FR-27), so a Teacher staffing two Tracks of one session is never
  satisfiable, structurally, not just a constraint that might not hold.

## Notes

- **Bug found and fixed while verifying T7 (2026-09-21)**:
  `TeacherScheduleGrid.vue` builds its own local `entitiesSnapshot` object
  (a plain copy of a few Store arrays, not the Store itself) to pass to
  the pure `buildTeacherScheduleGrid` — and that copy never included
  `jointSessions`. Every Teacher who *only* staffs Joint Session Tracks
  (no ordinary Assignment placements at all) showed "não tem aulas na
  versão ativa" instead of their actual Track schedule — a real gap,
  since a Teacher hired specifically to run Itinerários tracks is exactly
  the kind of Teacher this would happen to. Fixed by adding the missing
  field; `ExportView.vue` has the identical snapshot-construction pattern
  but doesn't yet read `jointSessions` from it either way (see the E12
  gap noted below), so it wasn't silently broken, just incomplete.
- **E12 (Human-Readable Export) does not show Joint Sessions yet** — out
  of scope for this epic (not an E10 task), but worth flagging plainly:
  `scheduleExport.ts` only ever reads `schedule.placements`, so a Joint
  Session's slot currently renders as a blank cell in both the print and
  `.xlsx` outputs, for both the per-Class and per-Teacher exports. Needs
  its own follow-up task on E12 (or a new one) before Joint Sessions are
  fully supported end-to-end.
- Verified end-to-end in headless Chromium, driving the real UI (not a
  pre-seeded schedule): created a Joint Session with 2 participating
  Classes and 2 Tracks via the "Sessões Conjuntas" screen, confirmed the
  duplicate-Teacher-across-Tracks rejection (button disabled + message),
  ran the actual solver ("Gerar Horário") with the session in the input,
  saved the result as a version, and confirmed both Per-Class views (each
  participating Class) and the Track Teacher's Per-Teacher view show the
  session correctly (distinct styling + name on Per-Class; session name +
  Track Subject on Per-Teacher). No console errors. This is agent-driven
  verification; the epic's own Human Verification steps were walked
  through and confirmed by the user (2026-09-21).
