//! Data types crossing the JS <-> Rust boundary (IMPL.md §6: serde +
//! serde-wasm-bindgen, plain JSON-shaped objects). These mirror the TS
//! entity types in `app/src/entities/*.ts` field-for-field (camelCase on
//! the wire) so the JS side can pass its entities-store state directly.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// D-10: the school week is fixed Monday-Friday.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Weekday {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
}

pub const WEEKDAYS: [Weekday; 5] = [
    Weekday::Mon,
    Weekday::Tue,
    Weekday::Wed,
    Weekday::Thu,
    Weekday::Fri,
];

impl Weekday {
    pub fn label_ptbr(self) -> &'static str {
        match self {
            Weekday::Mon => "segunda-feira",
            Weekday::Tue => "terça-feira",
            Weekday::Wed => "quarta-feira",
            Weekday::Thu => "quinta-feira",
            Weekday::Fri => "sexta-feira",
        }
    }
}

/// "HH:MM", 24h, zero-padded — compares correctly as a plain string, same
/// convention as `app/src/entities/time.ts`'s `ClockTime`.
pub type ClockTime = String;

pub fn ranges_overlap(a_start: &str, a_end: &str, b_start: &str, b_end: &str) -> bool {
    a_start < b_end && b_start < a_end
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeSlot {
    pub id: String,
    pub start: ClockTime,
    pub end: ClockTime,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakPeriod {
    pub id: String,
    pub start: ClockTime,
    pub end: ClockTime,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: String,
    pub name: String,
    pub time_slots: Vec<TimeSlot>,
    #[serde(default)]
    pub breaks: Vec<BreakPeriod>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Grade {
    pub id: String,
    pub segment_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Class {
    pub id: String,
    pub grade_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subject {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnavailabilityRange {
    pub id: String,
    pub weekday: Weekday,
    pub start: ClockTime,
    pub end: ClockTime,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Teacher {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub unavailability: Vec<UnavailabilityRange>,
    /// FR-11: optional per-Teacher limits — `None` means "no limit configured".
    #[serde(default)]
    pub max_periods_per_day: Option<u32>,
    #[serde(default)]
    pub min_consecutive_periods: Option<u32>,
    #[serde(default)]
    pub max_consecutive_periods: Option<u32>,
}

/// FR-10's hard ceiling: a block of consecutive same-subject periods never
/// exceeds 3 — mirrors `app/src/entities/assignment.ts`'s
/// `MAX_CONSECUTIVE_PERIODS`.
pub const MAX_CONSECUTIVE_PERIODS: u32 = 3;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Assignment {
    pub id: String,
    pub class_id: String,
    pub subject_id: String,
    pub teacher_ids: Vec<String>,
    pub weekly_occurrences: u32,
    pub consecutive_periods: u32,
    pub allow_same_day_repetition: bool,
}

/// FR-27: one (Subject, Teacher) pair within a Joint Session. All Tracks of
/// the same session always run in parallel, at the exact same slot(s) —
/// unlike `Assignment`, there's a single Teacher per Track, not a pool
/// (D-12's substitute-pool need is FR-36/Repair-specific and hasn't been
/// extended to Joint Sessions).
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub subject_id: String,
    pub teacher_id: String,
}

/// FR-25/26/27/28: a shared block attended simultaneously by `class_ids`
/// (validated same-Segment on the TS side — every participating Class must
/// resolve through the same Segment for a single `time_slot_id` to mean
/// the same real time for all of them), with `weekly_occurrences` parallel
/// occurrences of every Track in `tracks`. No individual-student data
/// (FR-26) — only which Classes and Teachers are occupied.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JointSession {
    pub id: String,
    pub name: String,
    pub class_ids: Vec<String>,
    pub tracks: Vec<Track>,
    pub weekly_occurrences: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleInput {
    pub segments: Vec<Segment>,
    pub grades: Vec<Grade>,
    pub classes: Vec<Class>,
    pub subjects: Vec<Subject>,
    pub teachers: Vec<Teacher>,
    pub assignments: Vec<Assignment>,
    #[serde(default)]
    pub joint_sessions: Vec<JointSession>,
}

/// One placed period: `classId` has `subjectId` taught by `teacherId` at
/// `weekday`/`timeSlotId`. `timeSlotId` always refers to a real Time Slot
/// (never a Break) of the Class's Segment (via Grade), so "no assignment
/// falls on a Break" is a modeling invariant, not a runtime check.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacedPeriod {
    pub class_id: String,
    pub subject_id: String,
    pub teacher_id: String,
    pub weekday: Weekday,
    pub time_slot_id: String,
}

/// FR-25/27/31: one occurrence of a Joint Session — every Class in its
/// `classIds` and every Track's Teacher are occupied at `weekday`/
/// `timeSlotId`, but (FR-30) this never satisfies any individual (Class,
/// Subject) requirement, so it's tracked separately from `placements`
/// rather than as N `PlacedPeriod`s with a synthetic Subject/Teacher.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JointSessionPlacement {
    pub joint_session_id: String,
    pub weekday: Weekday,
    pub time_slot_id: String,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub placements: Vec<PlacedPeriod>,
    #[serde(default)]
    pub joint_session_placements: Vec<JointSessionPlacement>,
}

/// Structured, hard-constraint (FR-14) violations. Every variant carries a
/// ready-to-display pt-BR `message` (FR-1) plus the structured ids a future
/// UI can use to highlight the affected cell(s) (FR-18).
/// `rename_all = "camelCase"` on the enum itself only renames the `type`
/// tag (e.g. `TeacherDoubleBooked` -> `"teacherDoubleBooked"`) — serde does
/// NOT cascade it into each struct-like variant's own fields, so every
/// variant repeats the attribute for its fields (`teacher_id` ->
/// `teacherId`, etc.) to actually match `app/src/wasm/types.ts`'s
/// hand-written camelCase `Violation` union. Confirmed the hard way (E09):
/// without the per-variant attribute, the wasm binary emitted snake_case
/// field names while the TS side's `Violation` type claimed camelCase,
/// silently breaking any code that reads a field beyond `.message` — never
/// caught before because nothing did, until E09's conflict-flag mapping.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Violation {
    #[serde(rename_all = "camelCase")]
    TeacherDoubleBooked {
        teacher_id: String,
        weekday: Weekday,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    ClassDoubleBooked {
        class_id: String,
        weekday: Weekday,
        time_slot_id: String,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    OccurrenceCountMismatch {
        assignment_id: String,
        class_id: String,
        subject_id: String,
        required: u32,
        actual: u32,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    TeacherUnavailable {
        teacher_id: String,
        class_id: String,
        weekday: Weekday,
        time_slot_id: String,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    ConsecutiveBlockBroken {
        assignment_id: String,
        class_id: String,
        subject_id: String,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    ConsecutiveCeilingExceeded {
        class_id: String,
        subject_id: String,
        weekday: Weekday,
        run_length: usize,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    TeacherDailyLimitExceeded {
        teacher_id: String,
        weekday: Weekday,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    TeacherConsecutiveLimitViolated {
        teacher_id: String,
        weekday: Weekday,
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    SameDayRepetition {
        assignment_id: String,
        class_id: String,
        subject_id: String,
        weekday: Weekday,
        message: String,
    },
}

/// FR-16: the Constructor's single deepest dead-end, as a specific,
/// readable pt-BR message naming the Teacher/Class/Subject involved.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfeasibilityReport {
    pub message: String,
    pub class_id: Option<String>,
    pub subject_id: Option<String>,
    pub teacher_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum GenerateResult {
    Feasible { schedule: Schedule },
    Infeasible { reason: InfeasibilityReport },
}

/// Resolved lookups used throughout `verify`/the Constructor — built once
/// per run rather than re-scanning `ScheduleInput`'s flat arrays on every
/// check.
pub struct Index<'a> {
    pub class_by_id: HashMap<&'a str, &'a Class>,
    pub grade_by_id: HashMap<&'a str, &'a Grade>,
    pub segment_by_id: HashMap<&'a str, &'a Segment>,
    pub subject_by_id: HashMap<&'a str, &'a Subject>,
    pub teacher_by_id: HashMap<&'a str, &'a Teacher>,
    pub joint_session_by_id: HashMap<&'a str, &'a JointSession>,
    /// Each Segment's Time Slots, sorted by start time (defensive — the TS
    /// side already keeps these sorted per D-07, but `verify` must stay
    /// correct standalone against arbitrary/edited input, per FR-18).
    pub sorted_slots: HashMap<&'a str, Vec<&'a TimeSlot>>,
}

impl<'a> Index<'a> {
    pub fn build(input: &'a ScheduleInput) -> Self {
        let mut sorted_slots: HashMap<&str, Vec<&TimeSlot>> = HashMap::new();
        for segment in &input.segments {
            let mut slots: Vec<&TimeSlot> = segment.time_slots.iter().collect();
            slots.sort_by(|a, b| a.start.cmp(&b.start));
            sorted_slots.insert(segment.id.as_str(), slots);
        }
        Index {
            class_by_id: input.classes.iter().map(|c| (c.id.as_str(), c)).collect(),
            grade_by_id: input.grades.iter().map(|g| (g.id.as_str(), g)).collect(),
            segment_by_id: input.segments.iter().map(|s| (s.id.as_str(), s)).collect(),
            subject_by_id: input.subjects.iter().map(|s| (s.id.as_str(), s)).collect(),
            teacher_by_id: input.teachers.iter().map(|t| (t.id.as_str(), t)).collect(),
            joint_session_by_id: input
                .joint_sessions
                .iter()
                .map(|s| (s.id.as_str(), s))
                .collect(),
            sorted_slots,
        }
    }

    pub fn segment_of_class(&self, class_id: &str) -> Option<&'a Segment> {
        let class = self.class_by_id.get(class_id)?;
        let grade = self.grade_by_id.get(class.grade_id.as_str())?;
        self.segment_by_id.get(grade.segment_id.as_str()).copied()
    }

    /// A Class's ordered Time Slots (its Segment's, D-02: identical every
    /// weekday), or an empty slice if the Class/Grade/Segment chain is broken.
    pub fn slots_of_class(&self, class_id: &str) -> &[&'a TimeSlot] {
        self.segment_of_class(class_id)
            .and_then(|seg| self.sorted_slots.get(seg.id.as_str()))
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    pub fn class_label(&self, class_id: &str) -> String {
        let Some(class) = self.class_by_id.get(class_id) else {
            return "turma desconhecida".to_string();
        };
        let grade = self.grade_by_id.get(class.grade_id.as_str());
        let segment = grade.and_then(|g| self.segment_by_id.get(g.segment_id.as_str()));
        [
            segment.map(|s| s.name.as_str()),
            grade.map(|g| g.name.as_str()),
            Some(class.name.as_str()),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" / ")
    }

    pub fn subject_label(&self, subject_id: &str) -> String {
        self.subject_by_id
            .get(subject_id)
            .map(|s| s.name.clone())
            .unwrap_or_else(|| "disciplina desconhecida".to_string())
    }

    pub fn teacher_label(&self, teacher_id: &str) -> String {
        self.teacher_by_id
            .get(teacher_id)
            .map(|t| t.name.clone())
            .unwrap_or_else(|| "professor desconhecido".to_string())
    }

    /// A Joint Session's shared Time Slots, resolved via its first
    /// participating Class — every Class in `class_ids` is validated
    /// same-Segment (FR-25) on the TS side, so any of them resolves the
    /// same slot structure.
    pub fn slots_of_joint_session(&self, session: &JointSession) -> &[&'a TimeSlot] {
        session
            .class_ids
            .first()
            .map(|c| self.slots_of_class(c))
            .unwrap_or(&[])
    }
}

#[cfg(test)]
mod violation_serialization_tests {
    use super::{Violation, Weekday};

    /// Regression test for a real bug (found via E09's conflict-flag UI,
    /// the first code to ever read a `Violation` field beyond `.message`):
    /// `#[serde(rename_all = "camelCase")]` on the *enum* only renames the
    /// `type` tag, not each variant's own fields — every variant needs its
    /// own `#[serde(rename_all = "camelCase")]` too, or the wasm binary
    /// emits snake_case fields while `app/src/wasm/types.ts`'s hand-written
    /// `Violation` union claims camelCase, and every field but `.message`
    /// silently reads as `undefined` on the JS side.
    #[test]
    fn every_field_serializes_as_camel_case() {
        let violation = Violation::TeacherDoubleBooked {
            teacher_id: "t-1".to_string(),
            weekday: Weekday::Mon,
            message: "x".to_string(),
        };
        let json = serde_json::to_value(&violation).unwrap();
        assert_eq!(json["type"], "teacherDoubleBooked");
        assert_eq!(json["teacherId"], "t-1");
        assert!(
            json.get("teacher_id").is_none(),
            "field must not be snake_case"
        );
    }
}
