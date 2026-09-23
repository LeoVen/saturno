//! `score(input, schedule) -> ScoreBreakdown` (IMPL.md §4.2): the FR-15 soft
//! objectives for an already-valid Schedule. TR-9 frames these as "weighted
//! penalties" — every field here, including `total`, is lower-is-better
//! (zero is a perfect schedule on that dimension). Never meaningful on an
//! infeasible Schedule; both the Refiner (E13-T2) and the standalone UI
//! (E13-T7) only ever call this on a Schedule that already passes `verify`
//! with zero violations.
//!
//! Metric definitions are an implementation-only call — IMPL.md leaves the
//! exact formula and the weights combining the two penalties into `total`
//! open ("assumes fixed sensible defaults for MVP", §10). See
//! impls/DECISIONS.md.

use crate::model::{Index, Schedule, ScheduleInput, WEEKDAYS, Weekday};
use crate::verify::{Resolved, resolve};
use std::collections::HashMap;

/// Weight applied to `teacher_gap_penalty` in `total`.
const TEACHER_GAP_WEIGHT: f64 = 1.0;
/// Weight applied to `subject_distribution_penalty` in `total` — a
/// gap-minute and a distribution-variance point aren't the same unit; this
/// keeps both terms roughly comparable in magnitude at TR-10's scale (a
/// real week produces low hundreds of gap-minutes per Teacher, but only a
/// handful of variance points per Class/Subject), so neither term
/// structurally dominates `total` regardless of school size.
const SUBJECT_DISTRIBUTION_WEIGHT: f64 = 10.0;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdown {
    /// FR-15 ("minimize janelas"): total idle minutes across every
    /// Teacher's day, summed across the week — the real-clock-time span
    /// from a Teacher's first to last period that day, minus the periods
    /// they're actually teaching. A day with 0 or 1 placement can't have a
    /// gap and contributes nothing.
    pub teacher_gap_penalty: f64,
    /// FR-15 ("prefer spreading evenly"): for every (Class, Subject) with
    /// an Assignment, the population variance of its actual placements'
    /// per-weekday counts against a perfectly even spread — summed across
    /// every (Class, Subject). Zero means each is spread as evenly as its
    /// own weekly occurrence count allows.
    pub subject_distribution_penalty: f64,
    /// Weighted sum of the two penalties above — what the Refiner (E13-T2)
    /// actually compares candidates by.
    pub total: f64,
}

fn to_minutes(clock: &str) -> i64 {
    let mut parts = clock.split(':');
    let hours: i64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let minutes: i64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    hours * 60 + minutes
}

fn teacher_gap_penalty(resolved: &[Resolved]) -> f64 {
    let mut by_teacher_day: HashMap<(&str, Weekday), Vec<(&str, &str)>> = HashMap::new();
    for r in resolved {
        by_teacher_day
            .entry((r.teacher_id.as_str(), r.weekday))
            .or_default()
            .push((r.start.as_str(), r.end.as_str()));
    }

    let mut penalty = 0.0;
    for periods in by_teacher_day.values() {
        if periods.len() < 2 {
            continue;
        }
        let span_start = periods.iter().map(|(s, _)| to_minutes(s)).min().unwrap();
        let span_end = periods.iter().map(|(_, e)| to_minutes(e)).max().unwrap();
        let occupied: i64 = periods
            .iter()
            .map(|(s, e)| to_minutes(e) - to_minutes(s))
            .sum();
        // Placements never overlap on an already-valid Schedule (verify()
        // would have flagged TeacherDoubleBooked), so this is never
        // negative in practice — `.max(0)` is defensive, not load-bearing.
        penalty += ((span_end - span_start) - occupied).max(0) as f64;
    }
    penalty
}

fn subject_distribution_penalty(input: &ScheduleInput, schedule: &Schedule) -> f64 {
    let mut counts: HashMap<(&str, &str), [u32; 5]> = HashMap::new();
    for p in &schedule.placements {
        let day_index = WEEKDAYS.iter().position(|&w| w == p.weekday).unwrap();
        counts
            .entry((p.class_id.as_str(), p.subject_id.as_str()))
            .or_insert([0; 5])[day_index] += 1;
    }

    let mut penalty = 0.0;
    for assignment in &input.assignments {
        let key = (assignment.class_id.as_str(), assignment.subject_id.as_str());
        let Some(days) = counts.get(&key) else {
            continue;
        };
        let total: u32 = days.iter().sum();
        if total == 0 {
            continue;
        }
        let mean = f64::from(total) / 5.0;
        penalty += days
            .iter()
            .map(|&c| (f64::from(c) - mean).powi(2))
            .sum::<f64>();
    }
    penalty
}

pub fn score(input: &ScheduleInput, schedule: &Schedule) -> ScoreBreakdown {
    let idx = Index::build(input);
    let resolved = resolve(&idx, schedule);

    let teacher_gap_penalty = teacher_gap_penalty(&resolved);
    let subject_distribution_penalty = subject_distribution_penalty(input, schedule);
    let total = teacher_gap_penalty * TEACHER_GAP_WEIGHT
        + subject_distribution_penalty * SUBJECT_DISTRIBUTION_WEIGHT;

    ScoreBreakdown {
        teacher_gap_penalty,
        subject_distribution_penalty,
        total,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{
        Assignment, Class, Grade, PlacedPeriod, Segment, Subject, Teacher, TimeSlot,
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
        weekly_occurrences: u32,
    ) -> Assignment {
        Assignment {
            id: id.to_string(),
            class_id: class_id.to_string(),
            subject_id: subject_id.to_string(),
            teacher_ids: vec!["t1".to_string()],
            weekly_occurrences,
            consecutive_periods: 1,
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

    fn base_input() -> ScheduleInput {
        ScheduleInput {
            segments: vec![segment("seg1", 6)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "math", 5)],
            joint_sessions: Vec::new(),
        }
    }

    #[test]
    fn a_single_period_day_has_no_gap_penalty() {
        let input = base_input();
        let schedule = Schedule {
            placements: vec![placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0")],
            joint_session_placements: Vec::new(),
        };
        assert_eq!(score(&input, &schedule).teacher_gap_penalty, 0.0);
    }

    #[test]
    fn back_to_back_periods_have_no_gap_penalty() {
        let input = base_input();
        let schedule = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-1"),
            ],
            joint_session_placements: Vec::new(),
        };
        assert_eq!(score(&input, &schedule).teacher_gap_penalty, 0.0);
    }

    #[test]
    fn one_idle_period_between_two_placements_is_penalized_by_its_own_duration() {
        let input = base_input();
        // seg1-slot-0 (07:00-07:50), seg1-slot-1 (07:50-08:40) left empty,
        // seg1-slot-2 (08:40-09:30) — a single 50-minute idle period.
        let schedule = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-2"),
            ],
            joint_session_placements: Vec::new(),
        };
        assert_eq!(score(&input, &schedule).teacher_gap_penalty, 50.0);
    }

    #[test]
    fn gaps_are_resolved_by_real_clock_time_across_segments_in_the_same_day() {
        // Mirrors the D-01-style cross-Segment convention already
        // established in verify.rs/constructor.rs: a Teacher's day can span
        // two Segments with different period grids, and the gap between
        // them must be computed from real clock time, not slot indices.
        let mut input = base_input();
        input.segments.push(segment("seg2", 6));
        // seg2's first slot starts at 07:00 too (same convention as
        // segment()), so shift it out so there's a genuine 20-minute gap
        // after segA's 07:00-07:50 period ending and segB's 08:10 start.
        input.segments[1].time_slots[0].start = "08:10".to_string();
        input.segments[1].time_slots[0].end = "09:00".to_string();
        input.grades.push(grade("g2", "seg2"));
        input.classes.push(class("c2", "g2"));
        input.assignments.push(assignment("a2", "c2", "math", 5));

        let schedule = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c2", "math", "t1", Weekday::Mon, "seg2-slot-0"),
            ],
            joint_session_placements: Vec::new(),
        };
        assert_eq!(score(&input, &schedule).teacher_gap_penalty, 20.0);
    }

    #[test]
    fn a_perfectly_even_spread_has_no_distribution_penalty() {
        let input = base_input();
        let schedule = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Tue, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Wed, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Thu, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Fri, "seg1-slot-0"),
            ],
            joint_session_placements: Vec::new(),
        };
        assert_eq!(score(&input, &schedule).subject_distribution_penalty, 0.0);
    }

    #[test]
    fn concentrating_occurrences_on_one_day_scores_worse_than_spreading_them() {
        let input = base_input();
        let concentrated = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-1"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-2"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-3"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-4"),
            ],
            joint_session_placements: Vec::new(),
        };
        let spread = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Tue, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Wed, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Thu, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Fri, "seg1-slot-0"),
            ],
            joint_session_placements: Vec::new(),
        };
        let concentrated_penalty = score(&input, &concentrated).subject_distribution_penalty;
        let spread_penalty = score(&input, &spread).subject_distribution_penalty;
        assert!(concentrated_penalty > spread_penalty);
        assert_eq!(spread_penalty, 0.0);
    }

    #[test]
    fn total_is_the_weighted_sum_of_both_penalties() {
        let input = base_input();
        let schedule = Schedule {
            placements: vec![
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "math", "t1", Weekday::Mon, "seg1-slot-2"),
            ],
            joint_session_placements: Vec::new(),
        };
        let breakdown = score(&input, &schedule);
        let expected = breakdown.teacher_gap_penalty * TEACHER_GAP_WEIGHT
            + breakdown.subject_distribution_penalty * SUBJECT_DISTRIBUTION_WEIGHT;
        assert_eq!(breakdown.total, expected);
    }

    #[test]
    fn an_assignment_with_zero_placements_yet_contributes_no_distribution_penalty() {
        // A Refiner move can transiently be evaluated mid-search before
        // every Assignment's occurrences are all placed — score() must not
        // panic or wrongly penalize a (Class, Subject) that simply has no
        // placements yet in this candidate.
        let input = base_input();
        let schedule = Schedule {
            placements: Vec::new(),
            joint_session_placements: Vec::new(),
        };
        assert_eq!(score(&input, &schedule).subject_distribution_penalty, 0.0);
    }
}
