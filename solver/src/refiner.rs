//! IMPL.md §5.1's Refiner: starting from a Constructor's feasible Schedule,
//! repeatedly perturbs it and keeps only feasibility-preserving moves,
//! accepting or rejecting each by `score` (simulated-annealing-style —
//! always accept an improvement, sometimes accept a worse move early on to
//! escape local optima, cooling off as the run progresses).
//!
//! IMPL.md §5.3 (E13-T4): a real deep-search run is time-boxed and must
//! yield control back to the Worker's own message loop every ~100ms (to
//! `postMessage` progress and let a pending cancellation take effect) —
//! not one multi-minute blocking call. `RefineSession` is a resumable
//! search: it owns its RNG/current-Schedule/best-so-far state across
//! repeated `run_slice` calls, cooling by elapsed-time fraction
//! (`elapsed_ms / time_budget_ms`) rather than an iteration count known up
//! front.
//!
//! D-53: deliberately never reads a real clock itself — `run_slice` takes
//! both `elapsed_ms` (how much real time the caller has measured as spent
//! so far) and `iterations` (how many proposal attempts to make this call)
//! as plain arguments. The caller (the Worker's own slice-driving loop,
//! via `performance.now()`) owns all wall-clock measurement and decides
//! how to size each slice; `RefineSession` stays exactly as pure and
//! deterministic/TR-11-testable as E13-T2's original `refine(iterations)`
//! free function, which this replaces rather than sits alongside.

use crate::model::{Index, PlacedPeriod, Schedule, ScheduleInput, WEEKDAYS, Weekday};
use crate::score::{ScoreBreakdown, score};
use crate::verify::verify;
use rand::Rng;
use std::collections::HashSet;

/// One improved state the Refiner found — see `RefineSession::run_slice`'s
/// doc comment for exactly when one is emitted.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub schedule: Schedule,
    pub score: ScoreBreakdown,
}

/// D-51: `total`'s own magnitude is schedule-dependent (idle-minutes plus a
/// weighted variance term, not a fixed-range unit), so the starting
/// temperature is scaled off the initial Schedule's own score rather than a
/// fixed constant — a school with a naturally "tighter" or "looser" score
/// gets a proportionally tighter or looser willingness to accept a worse
/// move early on.
const INITIAL_TEMPERATURE_FRACTION: f64 = 0.2;
/// A `total` of 0.0 (a perfect starting schedule) would otherwise zero out
/// the temperature and disable early exploration entirely.
const MIN_INITIAL_TEMPERATURE: f64 = 1.0;

/// One `run_slice` call's outcome.
pub struct SliceOutcome {
    /// New best-so-far Candidates found during this slice specifically
    /// (not the session's whole history) — the caller accumulates these
    /// across slices itself.
    pub new_candidates: Vec<Candidate>,
    pub best_total: f64,
    /// `true` once the caller-supplied `elapsed_ms` has reached the
    /// session's own `time_budget_ms` — the caller should stop calling
    /// `run_slice` again.
    pub done: bool,
}

/// A resumable Refiner run (IMPL.md §5.3/D-53). Constructed once per deep-
/// search attempt from a Constructor's feasible `initial` Schedule, a seed
/// (IMPL.md §5.2: one per Worker), and the run's overall `time_budget_ms`
/// (FR-32); then driven by repeated `run_slice(elapsed_ms, iterations)`
/// calls — see `run_slice`'s own doc comment for why both are the caller's
/// job, not something this session measures itself.
pub struct RefineSession {
    input: ScheduleInput,
    rng: rand_chacha::ChaCha8Rng,
    current: Schedule,
    current_total: f64,
    best_total: f64,
    initial_temperature: f64,
    time_budget_ms: f64,
}

impl RefineSession {
    pub fn new(input: ScheduleInput, initial: Schedule, seed: u64, time_budget_ms: f64) -> Self {
        let current_total = score(&input, &initial).total;
        let initial_temperature =
            (current_total * INITIAL_TEMPERATURE_FRACTION).max(MIN_INITIAL_TEMPERATURE);
        RefineSession {
            input,
            rng: <rand_chacha::ChaCha8Rng as rand::SeedableRng>::seed_from_u64(seed),
            current: initial,
            current_total,
            best_total: current_total,
            initial_temperature,
            time_budget_ms,
        }
    }

    fn temperature_at(&self, elapsed_ms: f64) -> f64 {
        let progress = (elapsed_ms / self.time_budget_ms).min(1.0);
        self.initial_temperature * (1.0 - progress)
    }

    /// Runs up to `iterations` proposal attempts at a single temperature
    /// derived from `elapsed_ms` (constant for the whole call — cooling
    /// happens *between* calls, as the caller advances `elapsed_ms`, not
    /// within one). Does nothing (returns `done: true` immediately) if
    /// `elapsed_ms` has already reached `time_budget_ms`.
    ///
    /// D-53: deliberately takes both as plain arguments rather than reading
    /// a clock or an internal counter — `elapsed_ms` is how much real time
    /// the caller has measured as spent so far (e.g. via
    /// `performance.now()`), `iterations` is how many attempts to make this
    /// call (the caller's own proxy for "about how long one slice should
    /// take", tuned/adapted at the call site). This keeps `RefineSession`
    /// itself exactly as pure, deterministic, and TR-11-testable as E13-T2's
    /// original one-shot `refine(iterations)` free function — real
    /// wall-clock measurement and slice-pacing are the Worker's own
    /// slice-driving loop's job (IMPL.md §5.3), not this module's.
    ///
    /// A Candidate is emitted exactly when an accepted move produces a new
    /// best-ever `score().total` for this session (D-51) — not on every
    /// accepted move (simulated annealing can accept a worse move to
    /// escape a local optimum; that intermediate state is part of the
    /// walk, not a result worth surfacing on its own) and not via a
    /// separate "is this a local optimum" neighborhood check (expensive,
    /// and unnecessary since every emitted Candidate is, by construction,
    /// at least as good as everything found earlier in the run —
    /// IMPL.md §10 already flags acceptance/emission strategy as open for
    /// empirical tuning).
    ///
    /// Only ever perturbs `schedule.placements` — Joint Session placements
    /// (FR-25) are left untouched (D-51): moving one affects every
    /// participating Class and Track Teacher at once, a materially
    /// different and more expensive move than the two `propose_move`
    /// below makes, and IMPL.md §5.1 doesn't mention Joint Sessions as
    /// Refiner scope.
    pub fn run_slice(&mut self, elapsed_ms: f64, iterations: u32) -> SliceOutcome {
        let mut new_candidates = Vec::new();

        if elapsed_ms < self.time_budget_ms {
            let idx = Index::build(&self.input);
            let temperature = self.temperature_at(elapsed_ms);

            for _ in 0..iterations {
                let Some(candidate_schedule) =
                    propose_move(&idx, &self.input, &self.current, &mut self.rng)
                else {
                    continue;
                };
                if !verify(&self.input, &candidate_schedule).is_empty() {
                    continue;
                }

                let candidate_total = score(&self.input, &candidate_schedule).total;
                let delta = candidate_total - self.current_total;
                let accept = delta <= 0.0
                    || (temperature > 0.0
                        && self.rng.r#gen::<f64>() < (-delta / temperature).exp());
                if !accept {
                    continue;
                }

                self.current = candidate_schedule;
                self.current_total = candidate_total;

                if self.current_total < self.best_total {
                    self.best_total = self.current_total;
                    new_candidates.push(Candidate {
                        schedule: self.current.clone(),
                        score: score(&self.input, &self.current),
                    });
                }
            }
        }

        SliceOutcome {
            new_candidates,
            best_total: self.best_total,
            done: elapsed_ms >= self.time_budget_ms,
        }
    }
}

/// Picks a random Class with at least one placement and proposes either a
/// "reassign a slot" (move one placement to a currently-empty slot for that
/// Class) or a "swap two assignments" (trade two placements' slots) move —
/// IMPL.md §5.1's own two named examples. Returns `None` when the chosen
/// Class has no viable move this attempt (e.g. exactly one placement and no
/// other slot exists at all) rather than forcing one — the caller just
/// treats that as a wasted iteration, same as an infeasible proposal.
fn propose_move(
    idx: &Index,
    input: &ScheduleInput,
    current: &Schedule,
    rng: &mut impl Rng,
) -> Option<Schedule> {
    if input.classes.is_empty() {
        return None;
    }
    let class = &input.classes[rng.gen_range(0..input.classes.len())];

    let class_indices: Vec<usize> = current
        .placements
        .iter()
        .enumerate()
        .filter(|(_, p)| p.class_id == class.id)
        .map(|(i, _)| i)
        .collect();
    if class_indices.is_empty() {
        return None;
    }

    let can_swap = class_indices.len() >= 2;
    let occupied: HashSet<(Weekday, &str)> = class_indices
        .iter()
        .map(|&i| {
            let p = &current.placements[i];
            (p.weekday, p.time_slot_id.as_str())
        })
        .collect();
    let free_slots: Vec<(Weekday, &str)> = idx
        .slots_of_class(&class.id)
        .iter()
        .flat_map(|slot| WEEKDAYS.iter().map(move |&w| (w, slot.id.as_str())))
        .filter(|slot| !occupied.contains(slot))
        .collect();
    let can_move = !free_slots.is_empty();

    if !can_swap && !can_move {
        return None;
    }
    let do_swap = if can_swap && can_move {
        rng.gen_bool(0.5)
    } else {
        can_swap
    };

    let mut next = current.clone();
    if do_swap {
        let a = class_indices[rng.gen_range(0..class_indices.len())];
        let mut b = class_indices[rng.gen_range(0..class_indices.len())];
        while b == a {
            b = class_indices[rng.gen_range(0..class_indices.len())];
        }
        let (weekday_a, slot_a) = (
            next.placements[a].weekday,
            next.placements[a].time_slot_id.clone(),
        );
        next.placements[a].weekday = next.placements[b].weekday;
        next.placements[a].time_slot_id = next.placements[b].time_slot_id.clone();
        next.placements[b].weekday = weekday_a;
        next.placements[b].time_slot_id = slot_a;
    } else {
        let i = class_indices[rng.gen_range(0..class_indices.len())];
        let (weekday, slot_id) = free_slots[rng.gen_range(0..free_slots.len())];
        let placement: &mut PlacedPeriod = &mut next.placements[i];
        placement.weekday = weekday;
        placement.time_slot_id = slot_id.to_string();
    }

    Some(next)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{
        Assignment, Class, Grade, JointSessionPlacement, Segment, Subject, Teacher, TimeSlot,
    };

    fn time_slot(id: &str, start: &str, end: &str) -> TimeSlot {
        TimeSlot {
            id: id.to_string(),
            start: start.to_string(),
            end: end.to_string(),
        }
    }

    /// A Segment with `n` 50-minute periods starting at 07:00, no breaks.
    fn segment(id: &str, n: usize) -> Segment {
        let mut time_slots = Vec::new();
        let mut minutes = 7 * 60;
        for i in 0..n {
            let start = format!("{:02}:{:02}", minutes / 60, minutes % 60);
            minutes += 50;
            let end = format!("{:02}:{:02}", minutes / 60, minutes % 60);
            time_slots.push(time_slot(&format!("{id}-slot-{i}"), &start, &end));
        }
        Segment {
            id: id.to_string(),
            name: format!("Segmento {id}"),
            time_slots,
            breaks: Vec::new(),
        }
    }

    fn grade(id: &str, segment_id: &str) -> Grade {
        Grade {
            id: id.to_string(),
            segment_id: segment_id.to_string(),
            name: format!("Série {id}"),
        }
    }

    fn class(id: &str, grade_id: &str) -> Class {
        Class {
            id: id.to_string(),
            grade_id: grade_id.to_string(),
            name: format!("Turma {id}"),
        }
    }

    fn subject(id: &str) -> Subject {
        Subject {
            id: id.to_string(),
            name: format!("Disciplina {id}"),
        }
    }

    fn teacher(id: &str) -> Teacher {
        Teacher {
            id: id.to_string(),
            name: format!("Professor {id}"),
            unavailability: Vec::new(),
            max_periods_per_day: None,
            min_consecutive_periods: None,
            max_consecutive_periods: None,
        }
    }

    fn assignment(
        id: &str,
        class_id: &str,
        subject_id: &str,
        teacher_ids: &[&str],
        weekly_occurrences: u32,
    ) -> Assignment {
        Assignment {
            id: id.to_string(),
            class_id: class_id.to_string(),
            subject_id: subject_id.to_string(),
            teacher_ids: teacher_ids.iter().map(|s| s.to_string()).collect(),
            weekly_occurrences,
            consecutive_periods: 3,
            allow_same_day_repetition: true,
        }
    }

    fn placement(
        class_id: &str,
        subject_id: &str,
        teacher_id: &str,
        weekday: Weekday,
        slot: &str,
    ) -> PlacedPeriod {
        PlacedPeriod {
            class_id: class_id.to_string(),
            subject_id: subject_id.to_string(),
            teacher_id: teacher_id.to_string(),
            weekday,
            time_slot_id: slot.to_string(),
        }
    }

    /// Drives a `RefineSession` to completion the same way the real Worker
    /// slice-driving loop will (IMPL.md §5.3): repeated `run_slice` calls
    /// with `elapsed_ms` stepped forward by `elapsed_step_ms` each time,
    /// until `done`. Deterministic (no real clock involved) — same seed and
    /// same slice/step parameters always produce the same result.
    fn run_to_completion(
        input: &ScheduleInput,
        initial: &Schedule,
        seed: u64,
        time_budget_ms: f64,
        iterations_per_slice: u32,
        elapsed_step_ms: f64,
    ) -> Vec<Candidate> {
        let mut session = RefineSession::new(input.clone(), initial.clone(), seed, time_budget_ms);
        let mut candidates = Vec::new();
        let mut elapsed = 0.0;
        loop {
            let mut outcome = session.run_slice(elapsed, iterations_per_slice);
            candidates.append(&mut outcome.new_candidates);
            if outcome.done {
                break;
            }
            elapsed += elapsed_step_ms;
        }
        candidates
    }

    /// One Class, one Teacher, 5 weekly occurrences of one Subject in a
    /// 6-period Segment, concentrated into two runs on two weekdays — each
    /// run at or under the Assignment's own `consecutivePeriods` ceiling
    /// (3), so this is genuinely feasible, but far from FR-15's "spread
    /// evenly" ideal (Mon: 3, Tue: 2, Wed/Thu/Fri: 0) and leaves every
    /// other weekday's slots free for the Refiner to spread into.
    fn concentrated_but_feasible() -> (ScheduleInput, Schedule) {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 6)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "math", &["t1"], 5)],
            joint_sessions: Vec::new(),
        };
        let initial = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-1"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-2"),
                placement("c1", "math", "t1", Weekday::Tue, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Tue, "seg1-slot-1"),
            ],
            joint_session_placements: Vec::new(),
        };
        (input, initial)
    }

    #[test]
    fn run_slice_is_a_cheap_no_op_once_elapsed_ms_reaches_the_time_budget() {
        let (input, initial) = concentrated_but_feasible();
        let mut session = RefineSession::new(input, initial, 1, 100.0);

        let outcome = session.run_slice(100.0, 500);
        assert!(outcome.new_candidates.is_empty());
        assert!(outcome.done);

        // Calling again (as a driving loop might do once more before
        // noticing `done`) must stay a no-op, not panic or keep searching.
        let outcome = session.run_slice(150.0, 500);
        assert!(outcome.new_candidates.is_empty());
        assert!(outcome.done);
    }

    #[test]
    fn every_candidate_is_feasible_and_strictly_improves_on_the_one_before_it() {
        let (input, initial) = concentrated_but_feasible();
        assert!(
            verify(&input, &initial).is_empty(),
            "fixture must start feasible"
        );

        let candidates = run_to_completion(&input, &initial, 1, 1000.0, 50, 100.0);
        assert!(
            !candidates.is_empty(),
            "expected at least one improvement to be found"
        );

        let mut previous_total = f64::INFINITY;
        for c in &candidates {
            assert!(
                verify(&input, &c.schedule).is_empty(),
                "every emitted Candidate must itself be feasible"
            );
            assert!(
                c.score.total < previous_total,
                "candidates must be strictly improving, by construction of the emission rule"
            );
            previous_total = c.score.total;
        }
    }

    #[test]
    fn a_deliberately_bad_starting_schedule_ends_up_meaningfully_better() {
        let (input, initial) = concentrated_but_feasible();
        let initial_total = score(&input, &initial).total;

        let candidates = run_to_completion(&input, &initial, 7, 2000.0, 100, 100.0);
        let best = candidates.last().expect("expected an improvement");
        assert!(best.score.total < initial_total);
        // A fully spread-out (one-per-weekday) arrangement has zero
        // distribution penalty and zero gap penalty (never 2+ placements on
        // the same day) — reachable from this much slack within 2000
        // iterations.
        assert_eq!(best.score.total, 0.0);
    }

    #[test]
    fn same_seed_produces_the_same_candidates() {
        let (input, initial) = concentrated_but_feasible();

        let run_a = run_to_completion(&input, &initial, 42, 200.0, 20, 20.0);
        let run_b = run_to_completion(&input, &initial, 42, 200.0, 20, 20.0);
        let totals_a: Vec<f64> = run_a.iter().map(|c| c.score.total).collect();
        let totals_b: Vec<f64> = run_b.iter().map(|c| c.score.total).collect();
        assert_eq!(totals_a, totals_b);
    }

    #[test]
    fn a_class_with_no_placements_yields_no_move_without_panicking() {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 3)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("t1")],
            assignments: Vec::new(),
            joint_sessions: Vec::new(),
        };
        let initial = Schedule {
            placements: Vec::new(),
            joint_session_placements: Vec::new(),
        };
        let mut session = RefineSession::new(input, initial, 1, 1000.0);
        let outcome = session.run_slice(0.0, 50);
        assert!(outcome.new_candidates.is_empty());
    }

    #[test]
    fn a_fully_packed_already_optimal_class_only_swaps_and_never_improves() {
        // One Class, one Segment with exactly one Time Slot/day, 5 weekly
        // occurrences filling every weekday (one per day) — every
        // (weekday, slot) combination for this Class is already occupied,
        // so `propose_move` can only ever Swap (never Move), and every
        // permutation of "one placement per weekday" is equally optimal
        // (zero gap penalty, zero distribution penalty already) — nothing
        // should ever be emitted, and it must not panic on the
        // no-free-slot branch.
        let input = ScheduleInput {
            segments: vec![segment("seg1", 1)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "math", &["t1"], 5)],
            joint_sessions: Vec::new(),
        };
        let initial = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Tue, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Wed, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Thu, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Fri, "seg1-slot-0"),
            ],
            joint_session_placements: Vec::new(),
        };
        assert!(
            verify(&input, &initial).is_empty(),
            "fixture must start feasible"
        );
        assert_eq!(
            score(&input, &initial).total,
            0.0,
            "fixture must start already optimal"
        );

        let mut session = RefineSession::new(input, initial, 1, 1000.0);
        let outcome = session.run_slice(0.0, 200);
        assert!(outcome.new_candidates.is_empty());
    }

    #[test]
    fn joint_session_placements_are_never_touched() {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 5)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "math", &["t1"], 4)],
            joint_sessions: Vec::new(),
        };
        let joint = JointSessionPlacement {
            joint_session_id: "js1".to_string(),
            weekday: Weekday::Fri,
            time_slot_id: "seg1-slot-4".to_string(),
        };
        let initial = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-1"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-2"),
                placement("c1", "math", "t1", Weekday::Tue, "seg1-slot-0"),
            ],
            joint_session_placements: vec![joint.clone()],
        };

        let candidates = run_to_completion(&input, &initial, 3, 200.0, 20, 20.0);
        for c in &candidates {
            assert_eq!(c.schedule.joint_session_placements.len(), 1);
            let jp = &c.schedule.joint_session_placements[0];
            assert_eq!(jp.joint_session_id, joint.joint_session_id);
            assert_eq!(jp.weekday, joint.weekday);
            assert_eq!(jp.time_slot_id, joint.time_slot_id);
        }
    }
}
