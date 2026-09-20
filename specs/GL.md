# Saturno — Glossary

Alphabetical reference for every domain term used in PRD.md, FR.md, and TR.md. Where the term has a Portuguese label (since the product's UI is entirely pt-BR per FR-1), it's given in parentheses.

Entity hierarchy, for orientation before reading individual entries:

```
Segment (Segmento)
  └─ Grade (Ano/Série)
       └─ Class (Turma)            ← the normal schedulable unit
Joint Session (Sessão Conjunta)     ← a separate, cross-cutting unit spanning multiple Classes within one Segment
  └─ Track (Trilha)                ← one (Subject, Teacher) pair running inside a Joint Session
```

---

**Absence (Falta/Ausência)**
A one-off override marking a Teacher unavailable for a specific day or subset of that day's periods, distinct from their recurring weekly Availability (see *Teacher Availability*). Marking one vacates that Teacher's assignments for the affected period(s) and can trigger a *Repair* run. See FR-35.

**Break / Interval (Intervalo)**
A non-teaching period within a Segment's daily Time Slot sequence (e.g. a recess between classes). Defined per Segment, since different segments can have different numbers and lengths of breaks. No assignment may ever be scheduled onto a Break. See FR-5.

**Candidate (Schedule Candidate)**
One complete, Hard-Constraint-satisfying schedule produced during a Deep Search run — one of potentially many, before the user picks one to keep as a Schedule Version. See FR-32, IMPL.md §5.

**Class (Turma)**
A section of a Grade — e.g. "7º Ano A" and "7º Ano B" are two different Classes belonging to the same Grade. A Class is the actual unit the solver builds a schedule for: it has its own fixed weekly grid, its own (Subject, Teacher) assignments, and its own required weekly occurrence counts. Distinct from Grade, which is just the level a Class belongs to. See FR-6.

**Conflict Flag**
A visible marker the system places on a slot when a manual edit (see *Manual Editing*) causes it to violate a Hard Constraint. The edit is still saved — the flag doesn't block it — but it stays visible until resolved. See FR-18.

**Consecutive Period Ceiling**
The hard rule that a Class may never have more than 3 periods of the same Subject in a row, regardless of how Double/Triple Periods are configured. See FR-10, FR-14.

**Constructor**
The first phase of the Solver's `generate` function: a greedy/backtracking search that builds one feasible schedule from scratch, respecting every Hard Constraint. Runs once per search; its failure (no feasible assignment found) is what an Infeasibility Report is built from. See IMPL.md §5.1.

**Deep Search (Busca Aprofundada) / Time Budget**
A generation run where the user sets an explicit time budget (e.g. several minutes) so the system explores many Candidates via the Refiner across a Worker Pool, instead of stopping at the first feasible schedule (contrast: quick mode, which is just the Constructor's output). See FR-32, IMPL.md §5.5.

**Double Period / Triple Period (Aula dupla / Aula tripla)**
A request that some of a (Class, Subject) pair's weekly occurrences be scheduled as back-to-back consecutive slots (2 or 3 in a row) rather than placed independently across the week. Capped by the Consecutive Period Ceiling. See FR-10.

**Gap ("Janela")**
Idle time within a Teacher's day, between their first and last assigned period, that isn't a Break. The solver treats minimizing this as a Soft Objective, not a Hard Constraint. See FR-15.

**Grade (Ano/Série)**
A school year/level (e.g. "7º Ano", "1ª Série"), belonging to exactly one Segment. A Grade is a grouping concept, not itself schedulable — the Classes within it are. See FR-6.

**Hard Constraint**
A rule the generated schedule must always satisfy — never traded off for the sake of a Soft Objective. Examples: no Teacher or Class double-booked, no assignment on a Break, every (Class, Subject) pair hits its exact Weekly Occurrence Count, the Consecutive Period Ceiling. The full list is in FR-14 (extended by FR-29 for Joint Sessions).

**Human-Readable Export**
A printable and/or spreadsheet (.xlsx) rendering of a schedule, laid out as a day/period grid meant to be read or shared by staff — distinct from the Native Export File, which is meant for round-tripping data back into Saturno. See FR-22, TR-13.

**IndexedDB**
The browser-native structured storage Saturno uses to persist all data locally, so it survives closing the browser or powering the computer off. Chosen over `localStorage` for its ability to hold larger, structured data. See TR-5.

**Infeasibility Report**
The diagnostic output the system produces when no valid schedule can be generated — naming the specific constraint or assignment that couldn't be satisfied, instead of a generic failure. See FR-16.

**Joint Session (Sessão Conjunta)**
A shared block attended simultaneously by a specified set of Classes (which may span multiple Grades, but must share one Segment), during which several Tracks run in parallel. Models periods like Ensino Médio's "Itinerários Formativos." Deliberately tracks no individual-student data — see *Track* and *Weekly Occurrence Count*. See FR-25–31.

**Manual Editing**
The act of moving or swapping an individual period assignment in a generated schedule by hand, after the solver has produced it. Checked against Hard Constraints (see *Conflict Flag*) but never blocked outright. See FR-17.

**Native Export File**
The single structured file (versioned via *Schema Version*) that captures Saturno's entire application state — all entities, constraints, Schedule Versions, manual edits, and Notes — for backup or transfer to another computer. Not intended to be hand-edited. See FR-23, TR-7, TR-12.

**Note / Annotation (Observação)**
Free-text a user attaches to a slot or to a schedule as a whole, typically to record the reason for a Manual Edit. See FR-19.

**Per-Class View**
A weekly grid display of one Class's full schedule. See FR-20.

**Per-Teacher View**
A weekly grid display of one Teacher's assignments across every Class (and Joint Session Track) they teach. See FR-21, FR-31.

**Refiner**
The second phase of the Solver's `generate` function: starting from the Constructor's feasible schedule, repeatedly perturbs it and keeps only Hard-Constraint-preserving moves, guided by the Scorer, to produce a diverse set of Candidates within the Time Budget. See IMPL.md §5.1.

**Repair**
A constrained re-solve triggered by a Teacher *Absence*: fills only the slot(s) the absence vacated, using another Teacher already configured for that (Class, Subject) pair, while leaving every other assignment in the current Schedule Version untouched. Distinct from both Quick and Deep generation (see *Solver*) — it never runs the Refiner or Scorer, and any slot it can't fill is reported, not silently skipped. See FR-36–37, IMPL.md §5.6.

**Schedule Version**
One named, complete instance of a generated/edited schedule (e.g. "2026", or a draft). A user can hold several at once and duplicate one as a starting point for a new one. See FR-24.

**Schema Version**
A field embedded in the Native Export File identifying which version of Saturno's data format it uses, so future versions of the app can detect and migrate older files. See TR-8.

**Scorer**
The function that computes a Candidate schedule's Soft Objective breakdown (e.g. teacher-gap score, subject-distribution score, plus a total) once it's already known to be valid — used to rank Candidates against each other. Named "Classifier" in an earlier draft of this design; renamed because it produces a continuous ranking score, not a discrete category. See FR-15, IMPL.md §4.2.

**Segment (Segmento)**
The top-level grouping of the school (e.g. "Ensino Fundamental," "Ensino Médio," or any other custom-named segment), under which Time Slots and Breaks are configured independently. A Joint Session's participating Classes must all belong to the same Segment. See FR-4.

**Soft Objective**
A schedule-quality goal the solver optimizes on a best-effort basis, without ever relaxing a Hard Constraint to achieve it — e.g. minimizing Gaps, spreading a Subject's occurrences evenly across the week. See FR-15.

**Solver**
The scheduling engine that takes all configured entities and constraints and automatically generates a complete timetable satisfying every Hard Constraint while optimizing Soft Objectives. Runs client-side inside a Web Worker. See FR-14/15, TR-3, TR-9–11.

**Subject (Disciplina)**
An item in the global catalog of teachable subjects (e.g. História, Matemática). See FR-7.

**Teacher (Professor)**
A person who can be assigned to teach a Subject to a Class (or a Track within a Joint Session). Names are not unique — two Teacher records can share the same name. See FR-2.

**Teacher Availability**
A Teacher's recurring weekly grid of which day/period combinations they can be scheduled into. Not a single whole-day/partial-day toggle — a full per-slot grid. See FR-3.

**Teacher ↔ Class ↔ Subject Relationship (Assignment)**
The configured fact that a specific Teacher teaches a specific Subject to a specific Class — the core unit the Solver places into time slots. See FR-9.

**Time Slot / Period (Horário)**
One bounded interval of time (24h format start/end) within a Segment's daily structure, either a teaching period or a Break. See FR-5.

**Track (Trilha)**
One (Subject, Teacher) pair running inside a Joint Session. All Tracks in the same Joint Session run in parallel, at the same time slot(s), whenever that session occurs. See FR-27.

**Verifier**
The function that checks a candidate schedule against every Hard Constraint and returns the specific violations found (empty if none). Used internally by the Constructor/Refiner during search, standalone to check a Manual Edit, and by *Repair* when filtering candidate substitute Teachers. See FR-14, FR-18, IMPL.md §4.1.

**Weekly Occurrence Count**
How many times per week something happens: either a (Class, Subject) pair (FR-8) or a Joint Session as a whole (FR-28). Scoped per Class for ordinary subjects since two Classes can require different weekly loads of the same Subject.

**Web Worker**
The browser mechanism used to run the Solver off the main UI thread, so schedule generation doesn't freeze the interface. See TR-3.

**Worker Pool**
Several independent Web Workers, each running its own Solver instance with a different random seed, used to parallelize a Deep Search run without requiring shared memory or special hosting headers. See IMPL.md §5.2.
