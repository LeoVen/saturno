# Saturno — Product Requirements Document

Version: v4 (supersedes v3) · Date: 2026-09-20

## 1. Problem Statement

School staff (this project's initial target: a school running "Lumière"/"LumiSol"-style timetables) currently build class timetables by hand in spreadsheets — assigning teachers to classes and time slots subject-by-subject, then manually adjusting the result to fix uneven distribution, gaps, and conflicts, and leaving free-text notes to record why a change was made. This is slow, error-prone (double-bookings, missed constraints), and starts nearly from scratch every term.

Saturno automates the constraint-satisfaction part of this process — generating a valid, reasonably good timetable from a school's configured teachers, classes, subjects, and constraints — while still letting staff review and hand-tune the result the way they already do today.

## 2. Goals

- Let a school configure its teachers, classes/sections, subjects, and scheduling constraints once, then regenerate or adjust timetables far faster than by hand.
- Automatically produce a timetable that is *correct* (no double-bookings, no constraint violations) without requiring the user to manually check for conflicts across dozens of teachers and classes.
- Preserve the flexibility schools already rely on: manual tweaks after generation, annotated with notes, without losing conflict visibility.
- Keep all school data — which includes teachers' personal names and schedules — entirely local to the user's machine, under their control, with an explicit way to move it to another machine.

## 3. Non-Goals (v1)

- Individual-student data of any kind — Saturno schedules Classes and Joint Sessions (§4, FR.md §G), never individual students. This is a permanent design boundary, not a v1 limitation.
- Room/classroom assignment.
- Legacy spreadsheet import — bootstrapping a school's first configuration from an existing file like the ones in `sheets/` is out of scope for v1; manual entry is the only way in (FR-23 stays scoped to Saturno's own native format). Resolved directly with the user; see §4.
- A full substitute-teacher/HR workflow (multi-day coverage, pay, scheduling swaps between staff). A narrow, same-day **Teacher Absence & Repair** feature *is* in scope — see FR.md §I — but it is deliberately not a general substitute-management system.
- Multi-user accounts, roles, permissions, or any server-side/cloud component.
- Mobile/phone-optimized layout.

## 4. Decisions Confirmed With User

These were open architectural/scope questions in prd-v1 that materially affect design; each was resolved directly with the user during this review rather than assumed:

| Decision | Resolution |
|---|---|
| Backend architecture | **Pure client-side SPA** — no server, no remote DB. Data lives in the browser (IndexedDB); portability is via explicit file export/import. |
| Cross-class/cross-grade shared periods (Itinerários-style) | **In scope for MVP**, but modeled as a lightweight **Joint Session** (FR.md §G) — a shared block where a set of Classes and several parallel (Subject, Teacher) Tracks are booked simultaneously — explicitly *without* any individual-student enrollment data. This was chosen over a full cross-class "Group" entity precisely because no per-student tracking is needed to solve the actual scheduling conflict. |
| Manual post-generation editing | **In scope**, with conflict checking: edits are checked against hard constraints and flagged if they violate one, but not blocked outright. |
| Solver schedule quality (gaps, same-day repeats) | **In scope as soft objectives**, optimized without ever relaxing a hard constraint. |
| Maximum consecutive periods of the same subject for one class | **Hard cap of 3** (raised by the user after the initial review pass; not derivable from the sample data alone). |
| Per-period cell content (Per-Class/Per-Teacher views, human-readable export) | **Show both Teacher and Subject**, even though the real sample sheets show only the teacher's name per cell. A deliberate improvement over the current manual artifacts, not a reproduction of their exact look. → FR-20–22. |
| Joint Session Track ↔ Class binding | **No binding tracked.** All Tracks in a Joint Session run in parallel with no per-Class assignment to a specific Track — confirmed despite the real 2026 EM sheet showing each participating Class's "ITINERÁRIO" cell in a different color (plausibly a Track indicator). FR-25–31 stand as originally written; no change needed. |
| Legacy Excel import | **Out of scope for v1.** Manual entry is the only way to create a school's first configuration; FR-23's export/import stays scoped to Saturno's own native format. |
| Substitute-teacher / absence workflow | **Narrow scope added, not full scope.** A same-day **Teacher Absence** override plus a **local-repair** re-solve (fills only the vacated slot(s), leaves every other assignment untouched) — not a general multi-day substitute-management system. → FR.md §I, IMPL.md §5.6. |
| Target scale (TR-10) | **Left as a stated assumption**, not confirmed — see §7. |
| Human-readable export scope (FR-22) | **Both printable and `.xlsx` ship in v1.** Printable via a browser print stylesheet (no new dependency); `.xlsx` via `exceljs` (styling support needed to match the real sheets' fills/merges). → TR-13, IMPL.md §9. |
| FR-16 infeasibility report depth | **Single deepest blocking issue, not an exhaustive scan.** A fuller multi-conflict report was considered and explicitly deferred — more solver work than its v1 benefit justifies. |
| FR-18 conflict-flag persistence | **Recomputed live** by calling the Verifier whenever a view renders — never stored on the Schedule Version, so it can't go stale. |
| FR-19 Notes storage | **Scoped to Schedule Version**, not global — lives in the schedule-versions store, not the entities store. Decided without a direct question (low ambiguity); flag if wrong. → IMPL.md §7. |
| TR-8 migration policy | **Migrate older files forward automatically** (sequential per-version migration functions); **reject newer files outright** with a clear error rather than guessing at an unknown future schema. Decided without a direct question (safe default); flag if wrong. → IMPL.md §7. |

## 5. Requirements

Full detail lives in two companion documents so each can be reviewed and versioned independently of this PRD:

- **[FR.md](./FR.md)** — numbered functional requirements (FR-1 … FR-37), each tagged `[ORIGINAL]`/`[REFINED]`/`[NEW]` against prd-v1, with the reasoning or evidence behind every change.
- **[TR.md](./TR.md)** — numbered technical requirements (TR-1 … TR-16) covering the client-only architecture, persistence, solver implementation constraints, and import/export formats.
- **[IMPL.md](./IMPL.md)** — implementation-level design: module boundaries, the Constructor/Refiner/Repair search algorithms, Worker-pool parallelism, the JS↔Rust/WASM interface, persistence/migration, and the human-readable export pipeline — implementing FR-32–34's time-boxed multi-solution generation, FR-35–37's absence repair, and FR-19/FR-22's notes and export.
- **[GL.md](./GL.md)** — alphabetical glossary of every domain term used across these documents.

Both were shaped in part by reading the real timetable spreadsheets in `sheets/` (Horário Lumière/LumiSol, 2023–2026) as ground truth for what the manual process actually produces today — not just prd-v1's prose description of it.

## 6. What Changed From prd-v1, and Why

prd-v1 was a solid first pass but under-specified in ways that only became visible by cross-checking it against real timetable data:

1. **"Grade" was the wrong unit of scheduling.** The real sheets schedule at the *section* level (e.g. "7° Ano A" vs "7° Ano B" have independent teachers and slots), which a grade-only model can't represent. → FR-6.
2. **Teacher time constraints were too coarse.** "Whole day or specific time of day" can't express the partial, recurring-but-irregular availability real teachers have. → FR-3.
3. **The solver description conflated inputs with requirements**, and stated only one hard constraint (weekly subject count) explicitly, leaving conflict-freeness and availability-respect implicit. These are now atomic, independently testable requirements. → FR-14.
4. **Nothing addressed schedule quality or manual correction**, even though the real sheets are full of evidence that both matter in practice (uneven-distribution fixes, annotated manual changes). → FR-15, FR-17–19.
5. **Nothing addressed what happens when no solution exists.** A solver that only ever says "success" or "generic failure" is not usable on a real, highly-constrained configuration. → FR-16.
6. **Export was only specified for the tool's own data**, but every real artifact in `sheets/` is a human-readable grid meant to be handed to staff — a distinct output requirement from lossless data interchange. → FR-22, TR-13.
7. **Double periods and same-day repetition weren't addressed at all**, despite being visibly relevant in the sample data and in a constraint the user raised directly (max 3 consecutive periods of the same subject). → FR-10, FR-12.
8. **Shared multi-class periods (Itinerário-style) weren't addressed at all**, and the obvious way to model them (a full cross-class "Group" with per-student enrollment) is far more than the actual scheduling problem needs. A **Joint Session** — Classes and parallel Teacher/Subject Tracks booked simultaneously, with no student data — solves the real conflict (classes and teachers occupied at once) at a fraction of the modeling cost, and was added to the MVP. → FR-25–31.

## 7. Assumptions Made (flag if wrong)

These were not blocking enough to hold up drafting, but are genuine guesses — correct any that are wrong:

- **Scale** (confirmed still a stated assumption, not a fact, per §4): solver performance is targeted at roughly the scale seen in the sample data — a few dozen teachers, 10–20 classes across 2 segments, 5-day weeks of 6–9 periods/day. If the real target is significantly larger (multiple schools, hundreds of teachers), the solver approach in TR-9/TR-10 should be revisited.
- **Manual-edit conflicts are flagged, not blocked** (FR-18) — i.e., the user can knowingly save a conflicting manual edit. If conflicts should instead be a hard block, that's a small but real change to FR-18.
- **Browser support**: latest two versions of Chrome/Edge/Firefox; no legacy-browser commitment (TR-14).
- **No phone-width layout** is required for v1 (TR-15).
- **Teacher Absence & Repair (FR.md §I) reuses only already-configured Teacher↔Class↔Subject relationships.** Repairing a vacated slot only considers teachers already linked to that (Class, Subject) via FR-9 — Saturno does not model a separate "which teachers are generally qualified to teach Subject X" pool. If the absent teacher was the *only* one configured for that (Class, Subject), the slot is reported unfillable (FR-37), not offered to an unrelated teacher. This is an assumption made to avoid adding a new entity; flag if a broader substitute pool is actually needed.

## 8. Open Questions

None outstanding as of this v4 revision. v3 resolved the four open questions carried from v2 (legacy import, substitute workflow, scale, Joint Session shape). v4 closed the remaining implementation-level gaps found while cross-referencing FR.md/TR.md against IMPL.md: human-readable export scope and mechanism, FR-16's infeasibility report depth, and FR-18's conflict-flag persistence (all resolved directly with the user — §4), plus FR-19's Notes storage and TR-8's migration policy (decided without a direct question, low-ambiguity implementation defaults — also §4, flagged there for override). Genuine assumptions that remain — not blocking, but worth re-checking — are tracked in §7.

---

*This document, FR.md, and TR.md should be read together. Functional and technical requirements are the source of truth for implementation; this PRD is the narrative context and decision record around them.*
