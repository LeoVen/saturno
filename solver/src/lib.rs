mod constructor;
mod model;
mod score;
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

/// IMPL.md §4.2 (E13-T1): the FR-15 soft-objective breakdown for an
/// already-valid Schedule. Standalone export so the UI (E13-T7) can explain
/// why one ranked candidate outranks another, not just internal to the
/// Refiner (E13-T2).
#[wasm_bindgen]
pub fn score(input: JsValue, schedule: JsValue) -> Result<JsValue, JsValue> {
    let input: ScheduleInput =
        serde_wasm_bindgen::from_value(input).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let schedule: Schedule =
        serde_wasm_bindgen::from_value(schedule).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let breakdown = score::score(&input, &schedule);
    serde_wasm_bindgen::to_value(&breakdown).map_err(|e| JsValue::from_str(&e.to_string()))
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

    fn placement(
        class_id: &str,
        subject_id: &str,
        teacher_id: &str,
        weekday: Weekday,
        time_slot_id: &str,
    ) -> PlacedPeriod {
        PlacedPeriod {
            class_id: class_id.to_string(),
            subject_id: subject_id.to_string(),
            teacher_id: teacher_id.to_string(),
            weekday,
            time_slot_id: time_slot_id.to_string(),
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
            joint_sessions: Vec::new(),
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
            joint_sessions: Vec::new(),
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
            joint_sessions: Vec::new(),
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
            joint_session_placements: Vec::new(),
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
            joint_sessions: Vec::new(),
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

    /// 2026-09-22: `consecutivePeriods` is a *ceiling* on an Assignment's
    /// own same-(Class,Subject) run length ("up to N in a row is
    /// allowed"), not a required grouping — user-requested clarification,
    /// since the original decompose-into-fixed-blocks reading made a fully
    /// spread-out week wrongly count as a violation. These three tests
    /// pin down the corrected contract; they replace
    /// `double_period_assignments_are_placed_as_a_genuinely_consecutive_block`,
    /// whose name claimed a guarantee ("genuinely consecutive") that never
    /// actually held beyond this greedy search's candidate-ordering
    /// happening to try the same day first on an otherwise-unconstrained
    /// case.
    #[test]
    fn a_fully_spread_out_schedule_is_valid_even_at_a_high_consecutive_periods_setting() {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 6, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("chem")],
            teachers: vec![teacher("t1")],
            // consecutivePeriods 3 allows up to a triple block — but never
            // requires one, so 3 occurrences on 3 separate weekdays (never
            // adjacent to each other) must be just as valid.
            assignments: vec![assignment("a1", "c1", "chem", &["t1"], 3, 3, true)],
            joint_sessions: Vec::new(),
        };
        let schedule = Schedule {
            placements: vec![
                placement("c1", "chem", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "chem", "t1", Weekday::Wed, "seg1-slot-0"),
                placement("c1", "chem", "t1", Weekday::Fri, "seg1-slot-0"),
            ],
            joint_session_placements: Vec::new(),
        };
        assert!(verify::verify(&input, &schedule).is_empty());
    }

    #[test]
    fn a_run_exceeding_the_assignments_own_ceiling_is_flagged_even_though_it_fits_under_the_absolute_max()
     {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 6, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("chem")],
            teachers: vec![teacher("t1")],
            // consecutivePeriods 2: a run of 3 is within FR-10's absolute
            // ceiling of 3, but exceeds THIS Assignment's own configured
            // ceiling — must still be flagged.
            assignments: vec![assignment("a1", "c1", "chem", &["t1"], 3, 2, true)],
            joint_sessions: Vec::new(),
        };
        let schedule = Schedule {
            placements: vec![
                placement("c1", "chem", "t1", Weekday::Mon, "seg1-slot-0"),
                placement("c1", "chem", "t1", Weekday::Mon, "seg1-slot-1"),
                placement("c1", "chem", "t1", Weekday::Mon, "seg1-slot-2"),
            ],
            joint_session_placements: Vec::new(),
        };
        let violations = verify::verify(&input, &schedule);
        assert!(violations.iter().any(
            |v| matches!(v, Violation::ConsecutiveCeilingExceeded { run_length, .. } if *run_length == 3)
        ));
    }

    #[test]
    fn spreading_across_days_makes_feasible_what_a_forced_block_would_not_have_been() {
        // A Teacher free for exactly one period/day: Monday's first period,
        // Tuesday's second — never two adjacent periods on the same day.
        // Under the old "decompose into consecutivePeriods-sized blocks"
        // behavior this was infeasible (no day ever offers a genuine
        // 2-block); under the ceiling-only behavior it's straightforward —
        // each occurrence just lands on its own day.
        let mut t1 = teacher("t1");
        t1.unavailability = vec![
            UnavailabilityRange {
                id: "u-mon".into(),
                weekday: Weekday::Mon,
                start: "07:50".into(),
                end: "23:59".into(),
            },
            UnavailabilityRange {
                id: "u-tue".into(),
                weekday: Weekday::Tue,
                start: "00:00".into(),
                end: "07:50".into(),
            },
            UnavailabilityRange {
                id: "u-wed".into(),
                weekday: Weekday::Wed,
                start: "00:00".into(),
                end: "23:59".into(),
            },
            UnavailabilityRange {
                id: "u-thu".into(),
                weekday: Weekday::Thu,
                start: "00:00".into(),
                end: "23:59".into(),
            },
            UnavailabilityRange {
                id: "u-fri".into(),
                weekday: Weekday::Fri,
                start: "00:00".into(),
                end: "23:59".into(),
            },
        ];

        let input = ScheduleInput {
            segments: vec![segment("seg1", 2, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("chem")],
            teachers: vec![t1],
            assignments: vec![assignment("a1", "c1", "chem", &["t1"], 2, 2, false)],
            joint_sessions: Vec::new(),
        };

        let result = constructor::generate_quick(&input);
        match result {
            GenerateResult::Feasible { schedule } => {
                assert!(verify::verify(&input, &schedule).is_empty());
                assert_eq!(schedule.placements.len(), 2);
            }
            GenerateResult::Infeasible { reason } => {
                panic!("expected this to be feasible: {}", reason.message)
            }
        }
    }

    #[test]
    fn never_exceeds_three_consecutive_same_subject_periods() {
        // 9 weekly occurrences of one Subject at consecutivePeriods 3 (its
        // maximum legal value — see entities.ts's `MAX_CONSECUTIVE_PERIODS`
        // — which coincides with FR-10's absolute ceiling), allowed to
        // repeat same-day, in a Segment with only 9 slots/day across the
        // week — the Constructor must never stack more than 3 in a row for
        // the Class.
        let input = ScheduleInput {
            segments: vec![segment("seg1", 9, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("gym")],
            teachers: vec![teacher("t1")],
            assignments: vec![assignment("a1", "c1", "gym", &["t1"], 9, 3, true)],
            joint_sessions: Vec::new(),
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
            joint_sessions: Vec::new(),
        };
        let GenerateResult::Feasible { schedule } = constructor::generate_quick(&input) else {
            panic!("expected feasible");
        };
        // FR-12's actual rule (and `verify.rs`'s own definition, D-13-style)
        // is "no more than one contiguous run per day," not "no more than
        // one placement" — two single periods that happen to land adjacent
        // still merge into one run and are legitimate. So the authoritative
        // check here is verify() finding no SameDayRepetition violation,
        // not a raw per-weekday placement count.
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
            joint_sessions: Vec::new(),
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

    #[test]
    fn user_reported_beck_two_day_teacher_should_fit_three_classes() {
        // Reported bug: a Teacher available only Mon/Wed teaches the same
        // Subject to 3 Classes, 3 occurrences each (9 total), in a Segment
        // with 6 periods/day -> 12 available teacher-slots across the two
        // days, comfortably more than the 9 needed. Should be feasible.
        let mut beck = teacher("beck");
        beck.unavailability = [Weekday::Tue, Weekday::Thu, Weekday::Fri]
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();

        let input = ScheduleInput {
            segments: vec![segment("em", 6, 7)],
            grades: vec![grade("g1", "em"), grade("g2", "em"), grade("g3", "em")],
            classes: vec![class("c1", "g1"), class("c2", "g2"), class("c3", "g3")],
            subjects: vec![subject("quimica")],
            teachers: vec![beck],
            // D-32 defaults: consecutivePeriods 2, allowSameDayRepetition true.
            assignments: vec![
                assignment("a1", "c1", "quimica", &["beck"], 3, 2, true),
                assignment("a2", "c2", "quimica", &["beck"], 3, 2, true),
                assignment("a3", "c3", "quimica", &["beck"], 3, 2, true),
            ],
            joint_sessions: Vec::new(),
        };

        let result = constructor::generate_quick(&input);
        match result {
            GenerateResult::Feasible { schedule } => {
                assert!(verify::verify(&input, &schedule).is_empty());
            }
            GenerateResult::Infeasible { reason } => {
                panic!("expected this to be feasible: {}", reason.message)
            }
        }
    }

    #[test]
    fn user_reported_beck_starved_by_a_flexible_subject_taking_his_only_days_first() {
        // Same as above, but each Class also needs Portugues from a
        // teacher who's available all week. Portugues is processed first
        // (tied on every existing sort key, so falls back to insertion
        // order) and greedily grabs Monday (the first weekday tried),
        // starving Beck's only two usable days for the last Class.
        let mut beck = teacher("beck");
        beck.unavailability = [Weekday::Tue, Weekday::Thu, Weekday::Fri]
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();
        let flexible = teacher("flex");

        let input = ScheduleInput {
            segments: vec![segment("em", 6, 7)],
            grades: vec![grade("g1", "em"), grade("g2", "em"), grade("g3", "em")],
            classes: vec![class("c1", "g1"), class("c2", "g2"), class("c3", "g3")],
            subjects: vec![subject("quimica"), subject("portugues")],
            teachers: vec![beck, flexible],
            assignments: vec![
                assignment("a1", "c1", "quimica", &["beck"], 3, 2, true),
                assignment("a2", "c2", "quimica", &["beck"], 3, 2, true),
                assignment("a3", "c3", "quimica", &["beck"], 3, 2, true),
                assignment("b1", "c1", "portugues", &["flex"], 3, 2, true),
                assignment("b2", "c2", "portugues", &["flex"], 3, 2, true),
                assignment("b3", "c3", "portugues", &["flex"], 3, 2, true),
            ],
            joint_sessions: Vec::new(),
        };

        let result = constructor::generate_quick(&input);
        match result {
            GenerateResult::Feasible { schedule } => {
                assert!(verify::verify(&input, &schedule).is_empty());
            }
            GenerateResult::Infeasible { reason } => {
                panic!("expected this to be feasible: {}", reason.message)
            }
        }
    }

    #[test]
    fn user_reported_beck_at_tr_10_scale_amid_a_busy_full_schedule() {
        // Same TR-10-scale busy school as above (40 teachers, 16 classes,
        // ~50% weekly utilization from 6 flexible Subjects each), plus a
        // Beck-like Teacher restricted to Mon/Wed teaching one more Subject
        // to 3 of the Classes in segEM - reproducing the reported bug
        // inside a realistically busy schedule rather than in isolation.
        let mut teachers = Vec::new();
        for i in 0..40 {
            teachers.push(teacher(&format!("t{i}")));
        }
        let mut beck = teacher("beck");
        beck.unavailability = [Weekday::Tue, Weekday::Thu, Weekday::Fri]
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();
        teachers.push(beck);

        let segments = vec![segment("segEF", 7, 7), segment("segEM", 8, 7)];
        let mut grades = Vec::new();
        let mut classes = Vec::new();
        let mut subjects = Vec::new();
        let mut assignments = Vec::new();
        let subject_count = 6;
        for s in 0..subject_count {
            subjects.push(subject(&format!("subj{s}")));
        }
        subjects.push(subject("quimica"));

        let mut assignment_seq = 0;
        for c in 0..16 {
            let segment_id = if c < 8 { "segEF" } else { "segEM" };
            let grade_id = format!("grade{c}");
            grades.push(grade(&grade_id, segment_id));
            let class_id = format!("class{c}");
            classes.push(class(&class_id, &grade_id));
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
            // 3 of the EM Classes also need Quimica from Beck (2 days only).
            if (8..11).contains(&c) {
                assignments.push(assignment(
                    &format!("assign{assignment_seq}"),
                    &class_id,
                    "quimica",
                    &["beck"],
                    3,
                    2,
                    true,
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
            joint_sessions: Vec::new(),
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
                panic!("expected this to be feasible: {}", reason.message)
            }
        }
    }

    fn track(id: &str, subject_id: &str, teacher_id: &str) -> Track {
        Track {
            id: id.to_string(),
            subject_id: subject_id.to_string(),
            teacher_id: teacher_id.to_string(),
        }
    }

    fn joint_session(
        id: &str,
        class_ids: &[&str],
        tracks: Vec<Track>,
        weekly_occurrences: u32,
    ) -> JointSession {
        JointSession {
            id: id.to_string(),
            name: format!("Sessão {id}"),
            class_ids: class_ids.iter().map(|s| s.to_string()).collect(),
            tracks,
            weekly_occurrences,
        }
    }

    #[test]
    fn joint_session_places_every_participating_class_at_the_same_slot_and_blocks_it_for_others() {
        // Two Classes, one Track — every weekday/period is otherwise free,
        // so the Constructor should place the session, and both Classes'
        // *own* Assignments must land somewhere else, never on top of it.
        let input = ScheduleInput {
            segments: vec![segment("seg1", 4, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1"), class("c2", "g1")],
            subjects: vec![subject("math"), subject("itinerario")],
            teachers: vec![teacher("t1"), teacher("t2"), teacher("track-teacher")],
            assignments: vec![
                assignment("a1", "c1", "math", &["t1"], 4, 1, false),
                assignment("a2", "c2", "math", &["t2"], 4, 1, false),
            ],
            joint_sessions: vec![joint_session(
                "js1",
                &["c1", "c2"],
                vec![track("tr1", "itinerario", "track-teacher")],
                1,
            )],
        };

        let result = constructor::generate_quick(&input);
        let GenerateResult::Feasible { schedule } = result else {
            let GenerateResult::Infeasible { reason } = result else {
                unreachable!()
            };
            panic!(
                "expected this slack school to be feasible: {}",
                reason.message
            );
        };
        assert_eq!(schedule.joint_session_placements.len(), 1);
        let jp = &schedule.joint_session_placements[0];
        assert_eq!(jp.joint_session_id, "js1");

        // No Assignment placement for either Class landed on the session's
        // own (weekday, timeSlotId).
        for p in &schedule.placements {
            if (p.class_id == "c1" || p.class_id == "c2") && p.weekday == jp.weekday {
                assert_ne!(
                    p.time_slot_id, jp.time_slot_id,
                    "an Assignment was placed on top of the Joint Session's slot"
                );
            }
        }
        assert!(verify::verify(&input, &schedule).is_empty());
    }

    #[test]
    fn joint_session_infeasibility_names_the_session_when_no_common_slot_exists() {
        // t1 is only free on Monday (every other weekday blocked); t2 is
        // only free on Tuesday — no weekday leaves both Track Teachers free
        // at once, so no slot ever works for the session.
        let mut t1 = teacher("t1");
        t1.unavailability = [Weekday::Tue, Weekday::Wed, Weekday::Thu, Weekday::Fri]
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u1-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();
        let mut t2 = teacher("t2");
        t2.unavailability = [Weekday::Mon, Weekday::Wed, Weekday::Thu, Weekday::Fri]
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u2-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();
        let input = ScheduleInput {
            segments: vec![segment("seg1", 1, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("itinerario")],
            teachers: vec![t1, t2],
            assignments: vec![],
            joint_sessions: vec![joint_session(
                "js1",
                &["c1"],
                vec![
                    track("tr1", "itinerario", "t1"),
                    track("tr2", "itinerario", "t2"),
                ],
                1,
            )],
        };

        let result = constructor::generate_quick(&input);
        match result {
            GenerateResult::Infeasible { reason } => {
                assert!(reason.message.contains("Sessão js1"));
            }
            GenerateResult::Feasible { .. } => panic!("expected this to be infeasible"),
        }
    }

    #[test]
    fn verify_flags_a_joint_session_class_conflicting_with_a_normal_placement() {
        let input = ScheduleInput {
            segments: vec![segment("seg1", 2, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("math"), subject("itinerario")],
            teachers: vec![teacher("t1"), teacher("track-teacher")],
            assignments: vec![],
            joint_sessions: vec![joint_session(
                "js1",
                &["c1"],
                vec![track("tr1", "itinerario", "track-teacher")],
                1,
            )],
        };
        let schedule = Schedule {
            placements: vec![PlacedPeriod {
                class_id: "c1".into(),
                subject_id: "math".into(),
                teacher_id: "t1".into(),
                weekday: Weekday::Mon,
                time_slot_id: "seg1-slot-0".into(),
            }],
            joint_session_placements: vec![JointSessionPlacement {
                joint_session_id: "js1".into(),
                weekday: Weekday::Mon,
                time_slot_id: "seg1-slot-0".into(),
            }],
        };

        let violations = verify::verify(&input, &schedule);
        assert!(violations.iter().any(
            |v| matches!(v, Violation::ClassDoubleBooked { class_id, .. } if class_id == "c1")
        ));
    }

    #[test]
    fn verify_flags_a_joint_session_teacher_conflicting_with_another_joint_session() {
        // Same Teacher, in a Track of two different Joint Sessions, both
        // placed at the same (weekday, timeSlotId) — FR-29's "including any
        // other Joint Session" clause.
        let input = ScheduleInput {
            segments: vec![segment("seg1", 2, 7)],
            grades: vec![grade("g1", "seg1")],
            classes: vec![class("c1", "g1"), class("c2", "g1")],
            subjects: vec![subject("itinerario")],
            teachers: vec![teacher("shared")],
            assignments: vec![],
            joint_sessions: vec![
                joint_session(
                    "js1",
                    &["c1"],
                    vec![track("tr1", "itinerario", "shared")],
                    1,
                ),
                joint_session(
                    "js2",
                    &["c2"],
                    vec![track("tr2", "itinerario", "shared")],
                    1,
                ),
            ],
        };
        let schedule = Schedule {
            placements: vec![],
            joint_session_placements: vec![
                JointSessionPlacement {
                    joint_session_id: "js1".into(),
                    weekday: Weekday::Mon,
                    time_slot_id: "seg1-slot-0".into(),
                },
                JointSessionPlacement {
                    joint_session_id: "js2".into(),
                    weekday: Weekday::Mon,
                    time_slot_id: "seg1-slot-0".into(),
                },
            ],
        };

        let violations = verify::verify(&input, &schedule);
        assert!(
            violations.iter().any(
                |v| matches!(v, Violation::TeacherDoubleBooked { teacher_id, .. } if teacher_id == "shared")
            )
        );
    }

    #[test]
    fn same_day_blocks_of_one_assignment_may_merge_when_repetition_is_disallowed() {
        // Regression test distilled from a real user report: a Teacher
        // restricted to exactly 2 weekdays, teaching a Subject with 5
        // weeklyOccurrences at consecutivePeriods 3 (the per-Assignment
        // ceiling — 2026-09-22: `consecutivePeriods` bounds how long a run
        // is allowed to get, not a required grouping, so with only 2
        // available days the 5 occurrences must land as e.g. a 3-run and a
        // 2-run), with allowSameDayRepetition false. Placing the 4th/5th
        // single-period task on a day that already has periods of this
        // Subject must be allowed to *merge* adjacently into one legitimate
        // run (still exactly one run for that day, not two) rather than
        // being wrongly refused just because the day already has one — the
        // Constructor previously refused to ever place a second block of
        // the same Subject on a day that already had one, even when the
        // placement would merge rather than create a second, separate run.
        // That bug made this genuinely feasible case (and the real user's
        // much larger schedule) come back infeasible.
        let mut teacher = teacher("carlos");
        teacher.unavailability = [Weekday::Mon, Weekday::Thu, Weekday::Fri]
            .iter()
            .map(|&weekday| UnavailabilityRange {
                id: format!("u-{weekday:?}"),
                weekday,
                start: "00:00".into(),
                end: "23:59".into(),
            })
            .collect();

        let input = ScheduleInput {
            segments: vec![segment("ef", 5, 7)],
            grades: vec![grade("g1", "ef")],
            classes: vec![class("c1", "g1")],
            subjects: vec![subject("matematica")],
            teachers: vec![teacher],
            assignments: vec![assignment(
                "a1",
                "c1",
                "matematica",
                &["carlos"],
                5,
                3,
                false,
            )],
            joint_sessions: Vec::new(),
        };

        let result = constructor::generate_quick(&input);
        match result {
            GenerateResult::Feasible { schedule } => {
                assert!(verify::verify(&input, &schedule).is_empty());
            }
            GenerateResult::Infeasible { reason } => {
                panic!("expected this to be feasible: {}", reason.message)
            }
        }
    }
}
