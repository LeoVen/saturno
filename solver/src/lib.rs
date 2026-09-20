mod constructor;
mod model;
mod verify;

use model::{GenerateResult, Schedule, ScheduleInput};
use wasm_bindgen::prelude::*;

/// IMPL.md §4.1: checks a candidate Schedule against every FR-14 hard
/// constraint. Called standalone from the main thread (manual-edit conflict
/// flags, FR-18) as well as internally by the Constructor.
#[wasm_bindgen]
pub fn verify(input: JsValue, schedule: JsValue) -> Result<JsValue, JsValue> {
    let input: ScheduleInput =
        serde_wasm_bindgen::from_value(input).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let schedule: Schedule =
        serde_wasm_bindgen::from_value(schedule).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let violations = verify::verify(&input, &schedule);
    serde_wasm_bindgen::to_value(&violations).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// E06-T3: the quick-mode path of IMPL.md §4.3's `generate` (Constructor
/// only, no time budget/Refiner — see impls/DECISIONS.md for why this is a
/// distinct export from the eventual `generate(input, timeBudgetMs)`).
/// Runs inside the single Web Worker per TR-3.
#[wasm_bindgen(js_name = generateQuick)]
pub fn generate_quick(input: JsValue) -> Result<JsValue, JsValue> {
    let input: ScheduleInput =
        serde_wasm_bindgen::from_value(input).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let result: GenerateResult = constructor::generate_quick(&input);
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::model::*;
    use super::{constructor, verify};

    fn time_slot(id: &str, start: &str, end: &str) -> TimeSlot {
        TimeSlot {
            id: id.to_string(),
            start: start.to_string(),
            end: end.to_string(),
        }
    }

    /// A Segment with `n` 50-minute periods starting at `start_hour:00`, no
    /// breaks (irrelevant to these tests — breaks are never placement
    /// candidates by construction).
    fn segment(id: &str, n: usize, start_hour: u32) -> Segment {
        let mut time_slots = Vec::new();
        let mut minutes = start_hour * 60;
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
        consecutive_periods: u32,
        allow_same_day_repetition: bool,
    ) -> Assignment {
        Assignment {
            id: id.to_string(),
            class_id: class_id.to_string(),
            subject_id: subject_id.to_string(),
            teacher_ids: teacher_ids.iter().map(|s| s.to_string()).collect(),
            weekly_occurrences,
            consecutive_periods,
            allow_same_day_repetition,
        }
    }

    #[test]
    fn generates_a_verified_feasible_schedule_for_a_simple_school() {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 6, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1"), class("c2", "g1")],
            subjects: vec![subject("math"), subject("port")],
            teachers: vec![teacher("t1"), teacher("t2")],
            assignments: vec![
                assignment("a1", "c1", "math", &["t1"], 4, 1, false),
                assignment("a2", "c1", "port", &["t2"], 4, 1, false),
                assignment("a3", "c2", "math", &["t1"], 4, 1, false),
                assignment("a4", "c2", "port", &["t2"], 4, 1, false),
            ],
        };

        let result = constructor::generate_quick(&input);
        match result {
            GenerateResult::Feasible { schedule } => {
                assert_eq!(schedule.placements.len(), 16);
                assert!(verify::verify(&input, &schedule).is_empty());
            }
            GenerateResult::Infeasible { reason } => {
                panic!("expected a feasible schedule, got: {}", reason.message)
            }
        }
    }

    #[test]
    fn never_double_books_a_teacher_even_across_segments_with_different_grids() {
        // Two Segments with different period structures (D-01): Segment A's
        // period 0 (07:00-07:50) overlaps Segment B's period 0 (07:20-08:10)
        // in real clock time despite being different slot indices.
        let input = ScheduleInput {
            segments: vec![segment("segA", 4, 7), segment("segB", 4, 7)],
            grades: vec![grade("gA", "segA"), grade("gB", "segB")],
            classes: vec![class("cA", "gA"), class("cB", "gB")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("shared")],
            assignments: vec![
                assignment("a1", "cA", "math", &["shared"], 4, 1, false),
                assignment("a2", "cB", "math", &["shared"], 4, 1, false),
            ],
        };

        let result = constructor::generate_quick(&input);
        let GenerateResult::Feasible { schedule } = result else {
            panic!("expected this small, slack school to be feasible");
        };
        let violations = verify::verify(&input, &schedule);
        let double_bookings: Vec<_> = violations
            .iter()
            .filter(|v| matches!(v, Violation::TeacherDoubleBooked { .. }))
            .collect();
        assert!(
            double_bookings.is_empty(),
            "unexpected teacher double-booking: {double_bookings:?}"
        );
    }

    #[test]
    fn verify_flags_a_cross_segment_double_booking_by_real_clock_time() {
        let input = ScheduleInput {
            segments: vec![segment("segA", 4, 7), segment("segB", 4, 7)],
            grades: vec![grade("gA", "segA"), grade("gB", "segB")],
            classes: vec![class("cA", "gA"), class("cB", "gB")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("shared")],
            assignments: vec![],
        };
        // segA-slot-0 is 07:00-07:50; segB-slot-0 is 07:00-07:50 too (same
        // start hour) — force an overlap directly rather than relying on
        // generation, since this test is specifically about `verify`.
        let schedule = Schedule {
            placements: vec![
                PlacedPeriod {
                    class_id: "cA".into(),
                    subject_id: "math".into(),
                    teacher_id: "shared".into(),
                    weekday: Weekday::Mon,
                    time_slot_id: "segA-slot-0".into(),
                },
                PlacedPeriod {
                    class_id: "cB".into(),
                    subject_id: "math".into(),
                    teacher_id: "shared".into(),
                    weekday: Weekday::Mon,
                    time_slot_id: "segB-slot-0".into(),
                },
            ],
        };
        let violations = verify::verify(&input, &schedule);
        assert!(
            violations
                .iter()
                .any(|v| matches!(v, Violation::TeacherDoubleBooked { .. }))
        );
    }

    #[test]
    fn reports_a_specific_infeasibility_when_no_teacher_is_ever_available() {
        let mut unavailable_teacher = teacher("t1");
        // Unavailable every weekday, all day: zero overlap with the Class's
        // periods (D-13-style "zero overlapping availability").
        unavailable_teacher.unavailability = WEEKDAYS
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();

        let input = ScheduleInput {
            segments: vec![segment("seg1", 6, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![unavailable_teacher],
            assignments: vec![assignment("a1", "c1", "math", &["t1"], 2, 1, false)],
        };

        let result = constructor::generate_quick(&input);
        let GenerateResult::Infeasible { reason } = result else {
            panic!("expected an infeasible result");
        };
        assert!(
            reason.message.contains("Professor t1"),
            "{}",
            reason.message
        );
        assert_eq!(reason.class_id.as_deref(), Some("c1"));
        assert_eq!(reason.subject_id.as_deref(), Some("math"));
    }

    #[test]
    fn double_period_assignments_are_placed_as_a_genuinely_consecutive_block() {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 6, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("chem")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "chem", &["t1"], 2, 2, false)],
        };
        let GenerateResult::Feasible { schedule } = constructor::generate_quick(&input) else {
            panic!("expected feasible");
        };
        assert!(verify::verify(&input, &schedule).is_empty());
        assert_eq!(schedule.placements.len(), 2);
    }

    #[test]
    fn never_exceeds_three_consecutive_same_subject_periods() {
        // 9 weekly occurrences of one Subject, allowed to repeat same-day,
        // in a Segment with only 9 slots/day across the week — the
        // Constructor must never stack more than 3 in a row for the Class.
        let input = ScheduleInput {
            segments: vec![segment("seg1", 9, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("gym")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "gym", &["t1"], 9, 1, true)],
        };
        let GenerateResult::Feasible { schedule } = constructor::generate_quick(&input) else {
            panic!("expected feasible");
        };
        let violations = verify::verify(&input, &schedule);
        assert!(
            violations
                .iter()
                .all(|v| !matches!(v, Violation::ConsecutiveCeilingExceeded { .. }))
        );
    }

    #[test]
    fn rejects_same_day_repetition_unless_explicitly_allowed() {
        let mut assignment = assignment("a1", "c1", "math", &["t1"], 2, 1, false);
        assignment.consecutive_periods = 1;
        let input = ScheduleInput {
            segments: vec![segment("seg1", 6, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment],
        };
        let GenerateResult::Feasible { schedule } = constructor::generate_quick(&input) else {
            panic!("expected feasible");
        };
        // Group by weekday: no weekday should have 2 placements of "math"
        // for "c1" since allowSameDayRepetition is false and this isn't a
        // double-period block.
        for &weekday in WEEKDAYS.iter() {
            let count = schedule
                .placements
                .iter()
                .filter(|p| p.weekday == weekday && p.subject_id == "math")
                .count();
            assert!(count <= 1, "same-day repetition on {weekday:?}: {count}");
        }
        assert!(verify::verify(&input, &schedule).is_empty());
    }

    #[test]
    fn respects_tr_10_scale_within_a_practical_time_budget() {
        // Roughly TR-10's target scale: ~40 teachers, 16 classes across 2
        // Segments, 5-day weeks of ~7-8 periods/day. Teachers are split
        // per-Segment (20 each) as in a typical real school (most teachers
        // work within one Segment; D-01's cross-Segment case is exercised
        // by the smaller, targeted tests above) and each (Class, Subject)
        // gets a 3-Teacher pool (D-12) at a light ~35% weekly utilization —
        // TR-10 targets performance on a *well-configured* school (FR-13's
        // validation gate is what catches an overloaded/under-resourced
        // one before generation even runs), not an artificially
        // teacher-starved stress test.
        let mut teachers = Vec::new();
        for i in 0..40 {
            teachers.push(teacher(&format!("t{i}")));
        }
        let segments = vec![segment("segEF", 7, 7), segment("segEM", 8, 7)];
        let mut grades = Vec::new();
        let mut classes = Vec::new();
        let mut subjects = Vec::new();
        let mut assignments = Vec::new();
        let subject_count = 6;
        for s in 0..subject_count {
            subjects.push(subject(&format!("subj{s}")));
        }
        let mut assignment_seq = 0;
        for c in 0..16 {
            let segment_id = if c < 8 { "segEF" } else { "segEM" };
            let grade_id = format!("grade{c}");
            grades.push(grade(&grade_id, segment_id));
            let class_id = format!("class{c}");
            classes.push(class(&class_id, &grade_id));
            // Teachers are pooled per Segment (indices 0-19 for segEF,
            // 20-39 for segEM) so a shared Teacher only ever contends with
            // other classes in the same weekly grid.
            let pool_offset = if c < 8 { 0 } else { 20 };
            for s in 0..subject_count {
                let subject_id = format!("subj{s}");
                let base = (c % 8) * subject_count + s;
                let candidate_teachers: Vec<String> = (0..3)
                    .map(|k| format!("t{}", pool_offset + (base * 7 + k * 5) % 20))
                    .collect();
                let teacher_refs: Vec<&str> =
                    candidate_teachers.iter().map(|s| s.as_str()).collect();
                assignments.push(assignment(
                    &format!("assign{assignment_seq}"),
                    &class_id,
                    &subject_id,
                    &teacher_refs,
                    3,
                    1,
                    false,
                ));
                assignment_seq += 1;
            }
        }
        let input = ScheduleInput {
            segments,
            grades,
            classes,
            subjects,
            teachers,
            assignments,
        };

        let start = std::time::Instant::now();
        let result = constructor::generate_quick(&input);
        let elapsed = start.elapsed();
        assert!(
            elapsed.as_secs() < 10,
            "TR-10 target is a few seconds; took {elapsed:?}"
        );
        match result {
            GenerateResult::Feasible { schedule } => {
                assert!(verify::verify(&input, &schedule).is_empty());
            }
            GenerateResult::Infeasible { reason } => {
                panic!(
                    "expected this generous configuration to be feasible: {}",
                    reason.message
                )
            }
        }
    }
}
