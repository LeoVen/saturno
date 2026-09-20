# Saturno — Functional Requirements

Status tags: `[ORIGINAL]` unchanged from prd-v1.md · `[REFINED]` present in v1 but reshaped/split for precision · `[NEW]` added during this review, with evidence cited.

Evidence base: prd-v1.md plus the real timetable spreadsheets in `sheets/` (Horário Lumière/LumiSol, 2023–2026), which are actual (or example) outputs of the manual process this tool replaces.

---

## A. Localization

**FR-1** `[ORIGINAL]` All user-facing interface text, labels, validation messages, and generated document output (exports, printables) must be in Brazilian Portuguese (pt-BR).

---

## B. Entity Configuration

**FR-2** `[ORIGINAL]` The user can create, edit, and delete **Teacher** records. Two or more teachers may share the exact same name (e.g. two "Guilherme" records are distinct entities, disambiguated internally, not by name).

**FR-3** `[REFINED]` The user can define a **Teacher's weekly availability** as a recurring grid over the week's time slots (day × period), marking each as available or unavailable — not merely a single "whole day or specific time of day" toggle.
> Why refined: real-world availability is rarely a single contiguous block (e.g. a teacher unavailable only on Tuesday afternoons, or teaching at another school certain mornings). A binary whole-day/partial-day model can't express this.

**FR-4** `[ORIGINAL]` The user can define one or more **Segments** (e.g. "Ensino Fundamental", "Ensino Médio", or any other custom-named segment) — the top-level grouping under which time slots and breaks are configured independently.

**FR-5** `[REFINED]` For each Segment, the user can define its own ordered set of **Time Slots** (period start/end time in 24h format) and **Break periods** (intervalo), including multiple breaks per day at different times (e.g. EF: one break 09:30–10:00; EM: two breaks, 08:40–08:55 and 10:35–10:50).

**FR-6** `[NEW]` A **Grade** (ano/série, e.g. "7º Ano") belongs to exactly one Segment. A **Class** (turma/section, e.g. "7º Ano A", "7º Ano B") belongs to exactly one Grade and is the actual unit the schedule is built for.
> Why new: prd-v1 modeled "Scholar year or grade" as the schedulable unit. The sample sheets show a grade is routinely split into multiple sections (e.g. `HorárioEF_24.08.2026_T1.xlsx` has "7° Ano A" and "7° Ano B" as separate, independently-scheduled columns). Without a Class entity distinct from Grade, two sections of the same grade couldn't have different teachers/schedules.

**FR-7** `[REFINED]` The user can define a global catalog of **Subjects** (e.g. História, Geografia, Matemática).

**FR-8** `[REFINED]` For each **(Class, Subject)** pair, the user can configure the **required weekly occurrence count** (how many periods per week that class has that subject). This is per class, not global per subject, since two sections or grades may require different weekly loads of the same subject.
> Why refined: prd-v1 stated this constraint ("how many class subjects weekly") without specifying it's scoped per class — left ambiguous whether it was global per subject or per class. Scoping per class matches how weekly loads actually vary by grade/segment.

**FR-9** `[ORIGINAL]` The user can define the **Teacher ↔ Class ↔ Subject** relationship: which teacher teaches which subject to which class. This is the core assignment the solver must place into the weekly grid.

**FR-10** `[NEW]` The user can flag that some or all of a (Class, Subject)'s weekly occurrences must be scheduled as **consecutive periods** ("aula dupla" / double period, or "aula tripla" / triple period) rather than spread independently. A block of consecutive same-subject periods for the same class must never exceed **3 periods in a row** — this is a hard ceiling, not a default the user raises.
> Why new: back-to-back double/triple periods are a standard real-world scheduling need for subjects like lab sciences, and the solver's placement logic differs materially for them (it must place a matched block, not N independent slots). The 3-period ceiling was specified directly by the user as a hard cap that applies regardless of how a class's weekly occurrences are otherwise configured.

**FR-11** `[NEW]` The user can optionally constrain, per Teacher, a **maximum number of periods per day** and/or a **minimum/maximum number of consecutive teaching periods**.
> Why new: not present in prd-v1; a common real constraint (e.g. part-time teachers, contractual limits) with no other way to express it in the current model.

**FR-12** `[NEW]` By default, a Class should not receive the same Subject twice on the same day unless that occurrence is an explicit double period (FR-10). The user can override this default per (Class, Subject).
> Why new: evidenced by the manual note in `HorárioEF_24.08.2026_T1.xlsx` ("Observação 1": a teacher ended up with 3 aulas on Monday and 5 on Thursday to fix an uneven distribution) — same-day repetition without it being an intentional double period is treated as a problem to fix, not a neutral outcome.

**FR-13** `[NEW]` The system validates entity configuration and warns the user before generation when a configuration is structurally infeasible or suspicious — e.g., a Class's total weekly required occurrences (FR-8) across all subjects exceeds the number of non-break periods available to it (FR-5), or a Teacher assigned to a Class/Subject has zero overlapping availability (FR-3) with that class's schedulable periods.
> Why new: prd-v1 describes the solver but never addresses detectable bad input; catching this before running the solver saves the user from an opaque "no solution" result.

---

## C. Scheduling Engine (Solver)

**FR-14** `[REFINED]` Given all configured entities and constraints, the system automatically generates a complete weekly timetable, satisfying these **hard constraints**:
  - No Teacher is assigned to two Classes in the same time slot.
  - No Class is assigned two Subjects in the same time slot.
  - Every (Class, Subject) pair reaches exactly its required weekly occurrence count (FR-8).
  - No assignment falls on a Break period (FR-5).
  - No assignment violates a Teacher's configured availability (FR-3).
  - Double/triple-period requests (FR-10) are placed as genuinely consecutive slots within the same day.
  - No Class ever has more than **3 consecutive periods** of the same Subject, under any configuration (FR-10's hard ceiling).
  - Per-teacher daily/consecutive limits (FR-11), when configured, are respected.
  - Same-day repetition rule (FR-12) is respected unless overridden.
> Why refined: prd-v1 described the solver as one paragraph mixing inputs and goal ("solve for fitting N class subjects of a subject S per week"). Requirements should be atomic and independently testable; this splits the single paragraph into an explicit, verifiable constraint list.

**FR-15** `[NEW]` Beyond the hard constraints in FR-14, the solver optimizes for schedule **quality** as soft, best-effort objectives (never traded off against a hard constraint):
  - Minimize gaps ("janelas") in a Teacher's day between their first and last assigned period.
  - Prefer spreading a Class's occurrences of a Subject evenly across the week where the count allows it.
> Why new: confirmed in scope directly by the user. Evidenced by the same manual "Observação" notes showing schedule quality (even distribution, minimizing awkward gaps) is something the school actively manages by hand today.

**FR-16** `[NEW]` If no feasible schedule exists, the system reports the specific constraint or assignment the Constructor's search identified as blocking (e.g., "Professor X: nenhum horário disponível compatível com Turma Y para a disciplina Z"), rather than failing silently or with a generic error.
> Why new: not addressed in prd-v1. An opaque failure on a real, complex configuration (dozens of teachers, multiple segments) would be unusable without diagnostic detail pointing at the actual conflict.
> Scope decision (confirmed with user): this reports the single deepest dead-end the backtracking search reaches, not an exhaustive scan of every unsatisfiable constraint in the configuration — a full multi-conflict scan would need meaningfully more solver work for limited v1 benefit. The user fixes the reported issue and reruns; if another blocking issue exists, it surfaces on the next attempt. See IMPL.md §5.1.

---

## D. Manual Editing & Change Tracking

**FR-17** `[NEW]` After a schedule is generated, the user can manually move or swap individual period assignments in the grid.
> Why new: confirmed in scope directly by the user, and evidenced by hand-written adjustment notes found across multiple real sheets (e.g. "Observação 1/2" in the 2026 file, an "Alterações" note in the 2024 year-end file) — schedules are routinely hand-tuned after an initial pass.

**FR-18** `[NEW]` When a manual edit introduces a violation of a hard constraint from FR-14 (double-booking, availability violation, etc.), the system visibly flags the conflict at the affected slot(s). The edit is not silently blocked — the user may still save it — but the conflict remains visibly flagged until resolved.
> Why new: confirmed in scope ("with conflict checking"). Flag-but-allow (rather than hard-block) is an assumption made to match real workflows where a school may knowingly accept a compromise.
> Implementation decision (confirmed with user): conflict flags are **not** persisted on the Schedule Version. They're recomputed by calling the Verifier (FR-14's `verify`) whenever a view renders, so a flag can never go stale relative to current entity data. See IMPL.md §4.1, §7.

**FR-19** `[NEW]` The user can attach a free-text note to an individual slot or to the schedule as a whole, scoped to that Schedule Version (FR-24), to record the reason for a manual override.
> Why new: directly evidenced by the "Observação 1", "Observação 2", and "Alterações" text found in the real spreadsheets — annotating manual changes is already part of the existing manual process and should not be lost when digitized.
> Display decision: notes are not purely internal — they appear in the human-readable export (FR-22) as a numbered footnote list beneath the grid, mirroring the real sheets' "Observação 1/2" convention exactly. A slot-level note is marked on its cell with a small reference marker linking to its footnote; a whole-schedule note appears in the list unmarked.

---

## E. Views & Output

**FR-20** `[NEW]` The user can view the generated/edited schedule as a weekly grid **per Class**, with each occupied period showing both the **Subject** and the **Teacher**.
> Why new: this is the primary view implied by prd-v1's data model but never explicitly stated as a requirement; made explicit since it's the main deliverable of the tool. Showing both fields is a deliberate decision (confirmed with the user) that improves on the real sample sheets, which show only the teacher's name per cell — Subject is a first-class part of the data model (FR-8) and should be visible, not just used internally by the solver.

**FR-21** `[NEW]` The user can view the generated/edited schedule as a weekly grid **per Teacher**, showing that teacher's assignments — **Class and Subject** — across every class they teach.
> Why new: not stated in prd-v1, but necessary to let a teacher (or the scheduler, checking FR-15's gap-minimization) see one person's full week — this view doesn't fall out of the per-class view automatically.

**FR-22** `[NEW]` The user can export a human-readable version of the schedule (per Class and per Teacher views, each period showing Subject and Teacher/Class per FR-20/21, plus any Notes per FR-19) as **both** a printable document and a spreadsheet (`.xlsx`) file — both formats ship in v1, confirmed with the user — in a grid layout comparable to the school's existing timetable format.
> Why new: prd-v1's only export requirement (TR) is for the tool's own data interchange. Every real sample file exists because the output needs to be handed to teachers/staff as a readable grid — this is a distinct requirement from raw data export.
> Layout decision: the export uses the real sheets' paper-oriented layout — two days per row, breaks shown as thin dividing rows — distinct from the app's own on-screen view (FR-20/21), which is a single continuous 5-day-wide grid better suited to interactive use (no phone-width requirement, TR-15). See TR-13, IMPL.md §9.

---

## F. Data Portability & Versioning

**FR-23** `[ORIGINAL]` The user can export all configured data (entities, constraints, generated/edited schedule, notes) to a file, and import that file on another computer to fully restore the same state.

**FR-24** `[NEW]` The user can maintain multiple independent **named schedule versions** (e.g. by year or by draft), switch between them, and duplicate an existing version as the starting point for a new one.
> Why new: evidenced by the real file set itself — multiple years (2023, 2024, 2025, 2026) and mid-year revisions (a distinct "FIM-DE-ANO" / year-end file) exist side by side, implying continuity (reusing last year's teacher/class roster) is part of the actual annual workflow.

---

## G. Joint Sessions (Shared Multi-Class Periods)

This section covers periods like Ensino Médio "Itinerários Formativos," where a set of classes — possibly spanning multiple grades — are simultaneously released from their normal per-class period into a shared block with several teachers running parallel tracks. **Confirmed in scope for the MVP** by the user, on the explicit condition that it requires no individual-student data (see FR-26).

**FR-25** `[NEW]` The user can define a **Joint Session** — a shared block attended simultaneously by a specified set of Classes, all of which must belong to the same Segment (since time-slot structures are defined per Segment, per FR-5, and may differ across segments).
> Why new: this is the "mixed entry" approach discussed with the user as an alternative to a full cross-class Group entity — it solves the actual scheduling conflict (classes and teachers occupied simultaneously) without needing to model which individual students attend which part of the session.

**FR-26** `[NEW]` A Joint Session tracks **no individual-student data** — not which students attend, not how a Class's roster splits across the session's Tracks (FR-27). It only tracks which Classes are collectively occupied by the session and which Teachers are occupied teaching within it.
> Why new: confirmed explicitly and directly by the user — per-student tracking is permanently out of scope for Saturno, not merely deferred. This is what keeps a Joint Session lightweight compared to a full cross-class "Group" entity: it needs no student-enrollment data at all.

**FR-27** `[NEW]` A Joint Session defines one or more **Tracks**, each a (Subject, Teacher) pair. All Tracks belonging to the same Joint Session run in parallel, occupying the exact same time slot(s), every time that session occurs.
> Why new: mirrors the real evidence in `HorárioEM_24.08.2026_T2.xlsx`, where "ITINERÁRIO" occupies the same slot across 1ª/2ª/3ª série simultaneously, and a Friday block shows parallel tracks ("Ciências Humanas," "Linguagens," "Ciências da Natureza") each presumably taught by a different teacher at the same time.

**FR-28** `[NEW]` The user configures how many times per week a Joint Session occurs — a weekly occurrence count scoped to the session as a whole, analogous to FR-8 but for the session rather than for an individual (Class, Subject) pair.
> Why new: a Joint Session isn't "a subject a class has," so its frequency can't be expressed through FR-8 — it needs its own weekly-count concept.

**FR-29** `[NEW]` Hard constraint (extends FR-14): for every occurrence of a Joint Session, all of its participating Classes must be simultaneously free of any other assignment at that slot, and all Teachers assigned to any of its Tracks must be simultaneously free of any other assignment — including any other Joint Session — at that slot.
> Why new: this is the actual scheduling-correctness requirement a Joint Session exists to satisfy; without it, the solver could still double-book a class or teacher into a Joint Session and something else at once.

**FR-30** `[NEW]` A Class's participation in a Joint Session occupies one of its weekly periods (and counts against that Class's total weekly period budget checked in FR-13), but does **not** count toward or satisfy any of that Class's individual (Class, Subject) weekly requirements from FR-8.
> Why new: prevents double-counting — a Joint Session period is not the same thing as a normal subject period for the participating classes, even though it consumes one of their slots.

**FR-31** `[NEW]` The per-Class view (FR-20) displays a Joint Session occurrence distinctly from a normal period, labeled with the session's name. The per-Teacher view (FR-21) additionally shows which specific Track that teacher is booked into.
> Why new: without this, a Joint Session period would be indistinguishable from an ordinary single-teacher period in the existing views, losing the "shared block, multiple tracks" meaning.

---

## H. Time-Boxed Multi-Solution Generation

This section formalizes generation behavior discussed with the user beyond FR-14's "produce a complete timetable": rather than surfacing a single generated result, the system explores the solution space for a user-set amount of time and lets the user choose among several valid, ranked outcomes. See IMPL.md for how this is implemented (Constructor/Refiner search, Worker pool parallelism, streaming progress).

**FR-32** `[NEW]` The user can run schedule generation with a configurable **time budget** (e.g. up to several minutes, user's choice). Within that budget, the system explores multiple distinct schedules that each satisfy every Hard Constraint (FR-14, FR-29), and presents them as a ranked list, ordered by the Soft Objectives from FR-15 — rather than surfacing only one result.
> Why new: this is the actual behavior the user described ("let it run for 10 minutes, all solutions ranked") — FR-14 as originally written implied a single generated output, which doesn't capture "explore, then choose."

**FR-33** `[NEW]` The user can select any one of the presented ranked candidates to adopt as an active Schedule Version (FR-24). Candidates not selected are discarded and not persisted, unless the user explicitly chooses to keep more than one.
> Why new: makes explicit what happens to the "losing" candidates from FR-32's ranked list — without this, it's unclear whether exploring costs storage/complexity beyond the one chosen result.

**FR-34** `[NEW]` While a generation run is in progress, the user sees live progress (at minimum: how many valid candidates have been found so far, and the best score found so far) and can cancel the run at any time, keeping whatever candidates were found up to that point.
> Why new: a multi-minute run with no feedback and no way to stop early is a poor interaction, especially once a good-enough candidate has already appeared well before the time budget elapses.

---

## I. Teacher Absence & Schedule Repair

Confirmed in scope for the MVP by the user, deliberately scoped narrow: a same-day absence override plus a re-solve that repairs only what the absence broke — not a general substitute-management system (multi-day coverage, pay, staff-initiated swaps stay out of scope; see "Explicitly Out of Scope" below).

**FR-35** `[NEW]` The user can mark a Teacher as **absent** for a specific day (or a specific subset of that day's periods), as a one-off override distinct from the Teacher's recurring weekly Availability (FR-3). Marking an absence immediately invalidates that Teacher's assignments for the affected period(s), leaving the corresponding Class slot(s) vacant.
> Why new: confirmed in scope directly by the user, as a narrower alternative to a full substitute-teacher HR workflow. A one-off override (vs. editing FR-3's recurring grid) matches the real scenario — a single day's absence, not a permanent availability change.

**FR-36** `[NEW]` For any vacated slot(s) from FR-35, the user can trigger a **repair** run: a re-solve that fills only the vacated slot(s) — using another Teacher already configured for that (Class, Subject) pair via FR-9 who is available at that time — while leaving every other assignment in the current Schedule Version completely untouched.
> Why new: confirmed directly by the user ("modifying the timetable and trying to solve again on the fly"), explicitly preferring this over a full re-generation (FR-32) that could reshuffle assignments the user never touched. This is a distinct solver mode from Constructor/Refiner (IMPL.md §5.6) — a constrained local search seeded from the existing Schedule, not a fresh build. Repair only considers Teachers already linked to the affected (Class, Subject) — see PRD.md §7's assumption on why no broader substitute pool is modeled.

**FR-37** `[NEW]` If no feasible repair exists for a vacated slot (e.g. no other Teacher is configured for that Class/Subject with matching availability), the system reports that specific slot as unfillable — extending FR-16's infeasibility reporting to repair runs — rather than leaving it silently empty or blocking the rest of the repair.
> Why new: mirrors FR-16's reasoning applied to repair mode — an unfillable slot needs to be visible and specific, not a silent gap the user discovers later by noticing a missing teacher on the grid.

---

## Explicitly Out of Scope for v1

- Room/classroom assignment — not present in any sample sheet or in prd-v1; not modeled in v1.
- Legacy spreadsheet import — bootstrapping a school's first configuration from an existing file like the ones in `sheets/` is out of scope for v1; manual entry is the only way in, and FR-23's import/export stays scoped to Saturno's own native format. Resolved directly with the user (see PRD.md §4).
- A **general** substitute-teacher / HR workflow — multi-day coverage, pay, staff-initiated coverage requests, or a broader "who else can teach Subject X" qualification pool beyond FR-9's configured relationships. The narrow same-day case is in scope; see FR.md §I.
- Multi-user accounts, roles, or permissions — no backend in v1 (see TR.md); single local user per browser profile.
