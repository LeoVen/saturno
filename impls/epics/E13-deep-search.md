# E13 — Deep Search

**Status**: new

## Goal

Beyond the single schedule Quick Generation (E06) produces, let the user run
a time-boxed search that explores many valid candidates in parallel, ranks
them by schedule quality, and lets them watch progress and cancel early.

## Spec references

- **FR-15** — soft objectives (gap minimization, even distribution), never traded against a hard constraint.
- **FR-32** — configurable time budget; ranked list of valid candidates.
- **FR-33** — select one candidate to adopt as a Schedule Version (E07); others discarded unless explicitly kept.
- **FR-34** — live progress (candidates found, best score so far); cancel anytime, keeping what's found.
- **TR-3** — full Worker pool (extends E06's single-Worker quick mode).
- **TR-9** — soft objectives as weighted penalties, optimized without relaxing hard constraints.
- **IMPL.md §4.2** (`score`), **§5.2** (Worker pool), **§5.3** (progress/cancellation), **§5.4** (deduplication), **§6** (throughput rationale).

## Human verification

1. Start a Deep Search with an explicit time budget (e.g. 2 minutes);
   confirm live progress (candidates found, best score) updates while it
   runs.
2. Cancel the run partway through; confirm whatever candidates were found
   so far are still presented, not discarded.
3. Let a run complete; confirm a ranked list of distinct (not
   near-duplicate) candidates is shown, each still satisfying every hard
   constraint from E06/E10.
4. Select one candidate and confirm it's adopted as the active Schedule
   Version (E07); confirm unselected candidates are not persisted unless
   explicitly kept.

## Tasks

| ID | Task | Status |
|---|---|---|
| E13-T1 | Implement `score(input, schedule) -> ScoreBreakdown` in Rust (FR-15, IMPL.md §4.2) | new |
| E13-T2 | Implement the Refiner: perturb + re-verify + accept/reject by score, simulated-annealing-style (IMPL.md §5.1) | new |
| E13-T3 | Worker pool: spawn N Workers (capped, per `navigator.hardwareConcurrency`), each with an independent RNG seed (IMPL.md §5.2) | new |
| E13-T4 | Progress streaming (`candidatesFoundSoFar`, `bestScoreSoFar`, `elapsedMs`) and cancellation flag, checked at slice boundaries (IMPL.md §5.3) | new |
| E13-T5 | Deduplication of near-identical candidates before ranking (IMPL.md §5.4) | new |
| E13-T6 | Coordinator: merge/rank candidates across Workers, hand the ranked list to the UI | new |
| E13-T7 | UI: time-budget input, live progress display, cancel button, ranked candidate list, "adopt as version" action wired to E07 (FR-32–34) | new |
| E13-T8 | Unit tests for `score` and the Refiner's hard-constraint preservation (TR-11) | new |

## Decisions

*(none yet — but see IMPL.md §10 for open implementation questions: Refiner acceptance strategy, Worker pool size cap, and deduplication threshold are all flagged there as needing empirical tuning once real candidates exist. Log the actual choices here once made.)*

## Notes

*(none)*
