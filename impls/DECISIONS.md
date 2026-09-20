# Decisions Log

Every entry here records a point where implementation either **deviated**
from `specs/`, **clarified** something the spec left genuinely open, or made
a standalone **implementation-only** call not covered by the spec at all
(e.g. a library choice, a folder layout). See `PROCESS.md` §5.

`specs/` is never edited to match these — this log, read together with
`specs/`, is the current source of truth. Newest entries at the top.

Template for a new entry:

```
## D-<NN> — <short title>

- **Date**: YYYY-MM-DD
- **Type**: Deviation | Clarification | Implementation-only
- **Spec refs**: FR-#, TR-#, or IMPL.md §# (omit if Implementation-only and genuinely nothing to reference)
- **What changes**: one or two sentences — what actually happens now, vs. what the spec said/left open.
- **Why**: the concrete reason (test result, user call, practical constraint).
- **Affected epics/tasks**: E##-... (so the epic file can point back here)
```

---

## D-01 — Teacher conflicts are detected by real clock time, across Segments

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-3, FR-5, FR-14
- **What changes**: a Teacher can teach in more than one Segment. FR-14's "no Teacher assigned to two Classes in the same time slot" is evaluated by comparing each assignment's **actual start/end clock time** (which every Time Slot already carries per FR-5), not by matching Segment-scoped period indices — two Segments' periods can overlap in real time despite having different structures. Teacher Availability (FR-3) is likewise modeled as time ranges per day, not tied to one Segment's period grid, so a single Teacher's availability applies uniformly across every Segment they teach in.
- **Why**: FR-5 gives each Segment its own independent period structure, so "same time slot" is otherwise ambiguous the moment a Teacher crosses Segments — a real scenario in smaller schools. Confirmed directly with the user; low extra implementation cost since Time Slots already store real clock times.
- **Affected epics/tasks**: E02 (Time Slot model must expose real start/end time), E04 (Teacher Availability grid modeled as time ranges, not per-Segment periods), E06 (Verifier's double-booking check compares real time overlap, not slot-index equality).

## D-02 — Segment daily structure is fixed across weekdays

- **Date**: 2026-09-20
- **Type**: Clarification
- **Spec refs**: FR-5
- **What changes**: within one Segment, the daily period/break structure (Time Slots + Breaks) is identical for every weekday it applies to — one structure per Segment, not one per (Segment, weekday). FR-5 didn't say either way.
- **Why**: matches how the real sample sheets in `sheets/` are laid out — one shared period-row structure across all weekday columns per segment. Confirmed directly with the user.
- **Affected epics/tasks**: E02 (Time Slot / Break data model).

---

*(entries above are the most recent — this file is otherwise empty)*
