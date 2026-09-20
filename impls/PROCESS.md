# Saturno — Implementation Process

This document defines *how* work happens from here on. It is itself a living
document: if the process stops fitting reality, edit this file and say so in
a commit — don't just quietly drift from it.

## 1. The two folders

- **`specs/`** — frozen. PRD.md, FR.md, TR.md, IMPL.md, GL.md are the v1
  design record. Nothing in `specs/` gets edited during implementation, even
  to "fix" something that turns out to be wrong. See §5 for what to do
  instead.
- **`impls/`** — everything about *building* the thing: planning artifacts
  (epics, tasks, board), decisions made along the way, and any
  implementation-level design notes that aren't part of the frozen spec.
  Application source code lives at the repo root (outside both), organized
  however the chosen frontend/solver tooling wants it (`src/`, `crate/`,
  etc.) — `impls/` holds the *paperwork* of building it, not the code itself.

Rationale: keeping planning artifacts out of `specs/` means the spec stays a
clean reference to diff against, and keeping them out of the source tree
means they survive framework scaffolding, refactors, and rewrites untouched.

## 2. Files in `impls/`

```
impls/
  PROCESS.md            this file
  BOARD.md               single source of truth for epic status (table)
  DECISIONS.md            log of deviations from spec + implementation-only decisions
  epics/
    _TEMPLATE.md         copy this to start a new epic
    E01-<slug>.md        one file per epic — its own tasks live inside it
    E02-<slug>.md
    ...
```

- **`BOARD.md`** tracks epics only, at a glance. It is the one place status
  is authoritative at the epic level — don't let it drift out of sync with
  the epic files' own task lists.
- **Task status lives inside its epic's file**, not in `BOARD.md` — an epic
  has few enough tasks that duplicating their status into a second file
  would just create a second place to forget to update.
- **`DECISIONS.md`** is the flexibility valve (§5) — every time an
  implementation choice overrides, narrows, or clarifies something the spec
  left ambiguous, it's recorded there, once, with a reason.

## 3. Epics

An epic is **a checkpoint a human can actually test** — open the running
app (or run a script/test suite) and see the thing work, not just "the code
compiles." If you can't describe a manual verification step for an epic,
it's either too abstract or too small to be an epic on its own.

Guidance on sizing: an epic should be small enough to land in a handful of
work sessions, and large enough to represent one coherent slice of user- or
system-visible capability (e.g. "entity configuration for Teachers/Classes/
Subjects is enter-able and persists across a reload" — not "build the
database layer" alone, and not "build the entire app").

Each epic gets its own file, `impls/epics/E<NN>-<slug>.md`, using
`_TEMPLATE.md`. It contains:

- **Goal** — one or two sentences, in plain terms.
- **Spec references** — which FR-#/TR-#/IMPL.md §-numbers this epic
  implements. This is the traceability link back to the frozen spec.
- **Human verification** — the concrete steps a person follows to confirm
  the epic is actually done (open the app, do X, expect Y).
- **Tasks** — a checklist/table of tasks, each with a status.
- **Notes** — anything worth remembering about *this* epic specifically that
  doesn't belong in `DECISIONS.md` (which is cross-epic).

## 4. Tasks

A task is one unit of work small enough to pick up and finish without
losing track of what "finished" means for it — roughly, something you'd
describe in one sentence and expect to land in one sitting.

**Status values** (exactly these four, no others):

| Status | Meaning |
|---|---|
| `new` | Identified, not started. |
| `in-progress` | Actively being worked. |
| `in-review` | Work is done; being checked (by the user, by tests, by a re-read) before calling it done. |
| `done` | Verified and complete. |

Rules:

- A task moves to `in-review` when the work is finished but not yet
  confirmed — this includes "I (the agent) believe this is correct but
  haven't had it checked."
- Only move a task to `done` after actual verification — running the tests,
  or the human doing the epic's verification steps if the task is the last
  one closing out an epic. Don't self-certify straight to `done`.
- An epic is `done` only when every one of its tasks is `done` **and** the
  epic's own Human Verification steps have been walked through.
- When you start a task, flip it to `in-progress` immediately — don't batch
  status updates to the end of a session.

## 5. Flexibility: overriding or steering away from the frozen spec

The spec is frozen as a *thinking record*, not as a contract that can never
be revisited. Reality during implementation (or hands-on testing of an
early version) may show that something specified is wrong, ambiguous where
it looked settled, or just not what's wanted once it's tangible. That's
expected and fine.

When it happens:

1. **Don't edit `specs/`.** It stays exactly as originally frozen — the
   record of what v1 thought going in.
2. **Record the change in `DECISIONS.md`** — every entry names the spec
   item(s) affected (FR-#/TR-#/section), what changes in practice, and why.
   This is what lets someone later understand why the running app doesn't
   match `specs/` FR-12 line for line without having to guess.
3. **Reference the decision from the affected epic/task** (a one-line
   pointer is enough) so anyone reading that epic sees the override instead
   of assuming the original FR/TR governs unmodified.
4. Small clarifications of something the spec left genuinely ambiguous
   (not a reversal, just a "here's what we picked") get logged the same
   way, at lighter weight — one line is fine.

This makes `DECISIONS.md` the actual current source of truth for "what does
Saturno do," read *together with* `specs/`, the same way `specs/PRD.md`
told you to read PRD/FR/TR together.

## 6. Definition of Done

- **Task**: code (or config, or content) complete, and — where applicable —
  covered by an automated test per TR-11's pure-function testability goal.
  `in-review` until actually checked, then `done`.
- **Epic**: every task `done`, plus the epic's Human Verification steps
  walked through successfully by a person, not just by an agent asserting
  it.

## 7. Session workflow

**Starting a session:**
1. Read `impls/PROCESS.md` (this file) if it's been a while.
2. Read `impls/BOARD.md` to see what epic is active.
3. Open that epic's file, find the next `new`/`in-progress` task.
4. Re-read the specific FR-#/TR-#/IMPL.md §-numbers that task cites before
   writing anything — don't work from memory of the spec.
5. Skim `DECISIONS.md` for anything relevant to the area being touched.

**Ending a session (or finishing a task):**
1. Update the task's status in its epic file.
2. Update `BOARD.md` if the epic's overall status changed (e.g. its first
   task went `in-progress`, or its last task went `done`).
3. If any spec deviation or non-obvious call was made, log it in
   `DECISIONS.md` *before* moving on — not from memory later.
4. Commit, following the repo's normal commit-message conventions.

## 8. What does *not* go in `impls/`

- Don't restate spec content — link to FR-#/TR-#/section instead of
  copy-pasting it; `specs/` is the source of truth for requirements text.
- Don't use `impls/` for narrative history ("what we did on Tuesday") — git
  history already is that record. `impls/` describes *current* state
  (what's the plan, what's decided, what's the status) not a changelog.
- Don't create a task for something with no epic — if it doesn't fit an
  existing epic's goal, that's a signal either a new epic is needed or the
  work isn't actually in scope yet.
