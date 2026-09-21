//! The Constructor (IMPL.md §5.1): a greedy/backtracking constructive
//! search producing one feasible Schedule, or — if it can't within a
//! bounded backtracking effort — the single deepest dead-end it reached
//! (FR-16). This is E06's "quick mode" (IMPL.md §5.5): the Refiner/Scorer
//! that turn this into a ranked multi-candidate search arrive with E13 and
//! are out of scope here.

use crate::model::{
    Assignment, GenerateResult, Index, InfeasibilityReport, MAX_CONSECUTIVE_PERIODS, PlacedPeriod,
    Schedule, ScheduleInput, Teacher, WEEKDAYS, Weekday,
};
use crate::verify::to_generate_result;
use std::collections::{HashMap, HashSet};

/// Bounds total backtracking effort so a genuinely hard/degenerate input
/// still returns within TR-10's "a few seconds" target instead of hanging.
/// Raised from 500_000 (D-33), alongside the scarce-Teacher-first ordering
/// heuristic above, in response to a real user report of a feasible school
/// being reported infeasible — extra backtracking headroom is cheap at
/// TR-10's scale (see `respects_tr_10_scale_within_a_practical_time_budget`,
/// still well under a second) even though the exact root cause wasn't
/// reproduced in isolation.
const SEARCH_BUDGET: u64 = 2_000_000;

struct Task {
    assignment_index: usize,
    block_size: u32,
}

/// Decomposes each Assignment's `weeklyOccurrences` into placement blocks of
/// `consecutivePeriods` size (a leftover remainder, if any, becomes its own
/// smaller block) — see impls/DECISIONS.md for why floor-division is the
/// chosen arithmetic (FR-8/FR-10 don't pin this down explicitly).
fn build_tasks(input: &ScheduleInput) -> Vec<Task> {
    let mut tasks = Vec::new();
    for (assignment_index, a) in input.assignments.iter().enumerate() {
        let block = a.consecutive_periods.max(1);
        let full_blocks = a.weekly_occurrences / block;
        let remainder = a.weekly_occurrences % block;
        for _ in 0..full_blocks {
            tasks.push(Task {
                assignment_index,
                block_size: block,
            });
        }
        if remainder > 0 {
            tasks.push(Task {
                assignment_index,
                block_size: remainder,
            });
        }
    }

    // Heuristic ordering only (feasibility-first; spreading/quality is
    // E13's Scorer/Refiner, out of scope here) — a standard "fail first"
    // CSP variable ordering to cut backtracking, most-constrained first:
    //   1. Assignments whose Teacher pool has the *least* weekday
    //      flexibility (e.g. a Teacher available only 2 days/week) go
    //      first — otherwise a less-constrained Subject sharing the same
    //      Class can grab a scarce Teacher's only usable weekdays simply
    //      by being tried first, forcing deep backtracking (or exhausting
    //      the search budget) to undo it later. Confirmed via a real user
    //      report: a 2-day-only Teacher's Assignment failed to place amid
    //      a busy schedule where this wasn't accounted for.
    //   2. Then classes with the heaviest weekly load.
    //   3. Then within a class, fewest candidate Teachers, biggest blocks.
    let teacher_by_id: HashMap<&str, &Teacher> =
        input.teachers.iter().map(|t| (t.id.as_str(), t)).collect();
    let flexibility_cache: HashMap<&str, usize> = input
        .assignments
        .iter()
        .map(|a| (a.id.as_str(), assignment_flexibility(a, &teacher_by_id)))
        .collect();
    let mut class_total: HashMap<&str, u32> = HashMap::new();
    for a in &input.assignments {
        *class_total.entry(a.class_id.as_str()).or_insert(0) += a.weekly_occurrences;
    }
    tasks.sort_by(|t1, t2| {
        let a1 = &input.assignments[t1.assignment_index];
        let a2 = &input.assignments[t2.assignment_index];
        let f1 = flexibility_cache.get(a1.id.as_str()).copied().unwrap_or(0);
        let f2 = flexibility_cache.get(a2.id.as_str()).copied().unwrap_or(0);
        let c1 = class_total.get(a1.class_id.as_str()).copied().unwrap_or(0);
        let c2 = class_total.get(a2.class_id.as_str()).copied().unwrap_or(0);
        f1.cmp(&f2)
            .then_with(|| c2.cmp(&c1))
            .then_with(|| a1.class_id.cmp(&a2.class_id))
            .then_with(|| a1.teacher_ids.len().cmp(&a2.teacher_ids.len()))
            .then_with(|| t2.block_size.cmp(&t1.block_size))
    });
    tasks
}

/// How many of the 5 weekdays a Teacher has *no* recorded unavailability on
/// at all — a cheap, coarse proxy for "how flexible is this Teacher," used
/// only to order the search (never to prune/reject a candidate).
fn teacher_open_weekday_count(teacher: &Teacher) -> usize {
    WEEKDAYS
        .iter()
        .filter(|&&weekday| !teacher.unavailability.iter().any(|u| u.weekday == weekday))
        .count()
}

/// An Assignment's real flexibility is bounded by its *least* constrained
/// Teacher option (D-12: the Constructor can pick any Teacher in the
/// pool) — an Assignment with no configured Teacher at all is treated as
/// maximally constrained (0), sorting it first so its dead end (if any) is
/// found as early as possible.
fn assignment_flexibility(
    assignment: &Assignment,
    teacher_by_id: &HashMap<&str, &Teacher>,
) -> usize {
    assignment
        .teacher_ids
        .iter()
        .filter_map(|id| teacher_by_id.get(id.as_str()))
        .map(|t| teacher_open_weekday_count(t))
        .max()
        .unwrap_or(0)
}

struct Candidate {
    weekday: Weekday,
    start: usize,
    teacher_id: String,
}

/// Nested (rather than flat-tuple-keyed) maps below so the hot candidate
/// -generation path (called far more often than `commit`/`undo`, which are
/// bounded by `SEARCH_BUDGET`) can look up "this Class's occupied slots" /
/// "this Class+day's placed Subjects" by `&str` without cloning `class_id`
/// per check.
#[derive(Default)]
struct SearchState {
    schedule: Vec<PlacedPeriod>,
    class_slot_occupied: HashMap<String, HashSet<(Weekday, usize)>>,
    /// class_id -> weekday -> [(slot_index, subject_id)] placed so far —
    /// backs the same-day-repetition check and the 3-period ceiling.
    class_day_subject: HashMap<String, HashMap<Weekday, Vec<(usize, String)>>>,
    /// teacher_id -> (weekday, start, end) placed so far, always appended
    /// in commit order — backtracking is depth-first over `tasks` in a
    /// fixed order, so an undo always reverses exactly the most recent
    /// commit (LIFO), letting undo just truncate tails instead of
    /// searching for what to remove.
    teacher_periods: HashMap<String, Vec<(Weekday, String, String)>>,
}

impl SearchState {
    fn commit(&mut self, idx: &Index, assignment: &Assignment, task: &Task, cand: &Candidate) {
        let slots = idx.slots_of_class(&assignment.class_id);
        let block = slots
            .iter()
            .enumerate()
            .skip(cand.start)
            .take(task.block_size as usize);
        for (i, &slot) in block {
            self.class_slot_occupied
                .entry(assignment.class_id.clone())
                .or_default()
                .insert((cand.weekday, i));
            self.class_day_subject
                .entry(assignment.class_id.clone())
                .or_default()
                .entry(cand.weekday)
                .or_default()
                .push((i, assignment.subject_id.clone()));
            self.teacher_periods
                .entry(cand.teacher_id.clone())
                .or_default()
                .push((cand.weekday, slot.start.clone(), slot.end.clone()));
            self.schedule.push(PlacedPeriod {
                class_id: assignment.class_id.clone(),
                subject_id: assignment.subject_id.clone(),
                teacher_id: cand.teacher_id.clone(),
                weekday: cand.weekday,
                time_slot_id: slot.id.clone(),
            });
        }
    }

    fn undo(&mut self, assignment: &Assignment, task: &Task, cand: &Candidate) {
        let size = task.block_size as usize;
        if let Some(set) = self.class_slot_occupied.get_mut(&assignment.class_id) {
            for i in cand.start..cand.start + size {
                set.remove(&(cand.weekday, i));
            }
        }
        if let Some(by_day) = self.class_day_subject.get_mut(&assignment.class_id)
            && let Some(v) = by_day.get_mut(&cand.weekday)
        {
            let range = cand.start..cand.start + size;
            v.retain(|(i, _)| !range.contains(i));
        }
        if let Some(v) = self.teacher_periods.get_mut(&cand.teacher_id) {
            let new_len = v.len() - size;
            v.truncate(new_len);
        }
        let new_len = self.schedule.len() - size;
        self.schedule.truncate(new_len);
    }
}

/// Extends `size` contiguous slots starting at `start` with any
/// same-subject run immediately adjacent on either side, returning the
/// resulting merged run length (FR-10's 3-period ceiling is checked
/// against this).
fn merged_run_length(
    day_entries: &[(usize, String)],
    start: usize,
    size: usize,
    subject_id: &str,
) -> usize {
    let mut len = size;
    let mut idx = start;
    while idx > 0 {
        idx -= 1;
        if day_entries
            .iter()
            .any(|(i, s)| *i == idx && s == subject_id)
        {
            len += 1;
        } else {
            break;
        }
    }
    let mut idx = start + size;
    while day_entries
        .iter()
        .any(|(i, s)| *i == idx && s == subject_id)
    {
        len += 1;
        idx += 1;
    }
    len
}

fn ranges_overlap(a_start: &str, a_end: &str, b_start: &str, b_end: &str) -> bool {
    crate::model::ranges_overlap(a_start, a_end, b_start, b_end)
}

fn teacher_ok(
    idx: &Index,
    state: &SearchState,
    teacher_id: &str,
    weekday: Weekday,
    block_times: &[(String, String)],
) -> bool {
    let Some(teacher) = idx.teacher_by_id.get(teacher_id) else {
        return false;
    };
    for (s, e) in block_times {
        if teacher
            .unavailability
            .iter()
            .any(|u| u.weekday == weekday && ranges_overlap(&u.start, &u.end, s, e))
        {
            return false;
        }
    }
    let no_periods: Vec<(Weekday, String, String)> = Vec::new();
    let all_periods = state.teacher_periods.get(teacher_id).unwrap_or(&no_periods);
    let existing_today = || all_periods.iter().filter(|(w, _, _)| *w == weekday);
    for (s, e) in block_times {
        if existing_today().any(|(_, es, ee)| ranges_overlap(es, ee, s, e)) {
            return false;
        }
    }
    let existing_count = existing_today().count();
    if let Some(max_daily) = teacher.max_periods_per_day
        && existing_count + block_times.len() > max_daily as usize
    {
        return false;
    }
    if let Some(max_c) = teacher.max_consecutive_periods {
        let mut all: Vec<(&str, &str)> = existing_today()
            .map(|(_, s, e)| (s.as_str(), e.as_str()))
            .collect();
        all.extend(block_times.iter().map(|(s, e)| (s.as_str(), e.as_str())));
        all.sort();
        let mut run = 1usize;
        let mut max_run = if all.is_empty() { 0 } else { 1 };
        for w in all.windows(2) {
            if w[0].1 == w[1].0 {
                run += 1;
            } else {
                run = 1;
            }
            max_run = max_run.max(run);
        }
        if max_run > max_c as usize {
            return false;
        }
    }
    true
}

fn candidates_for_task(
    idx: &Index,
    state: &SearchState,
    task: &Task,
    assignment: &Assignment,
) -> Vec<Candidate> {
    let mut candidates = Vec::new();
    let slots = idx.slots_of_class(&assignment.class_id);
    let n = slots.len();
    if n == 0 || assignment.teacher_ids.is_empty() || task.block_size as usize > n {
        return candidates;
    }
    let by_day = state.class_day_subject.get(assignment.class_id.as_str());
    let occupied = state.class_slot_occupied.get(assignment.class_id.as_str());
    let empty_day: Vec<(usize, String)> = Vec::new();
    for &weekday in WEEKDAYS.iter() {
        let day_entries = by_day.and_then(|m| m.get(&weekday)).unwrap_or(&empty_day);
        let already_has_subject_today =
            day_entries.iter().any(|(_, s)| s == &assignment.subject_id);
        if already_has_subject_today && !assignment.allow_same_day_repetition {
            continue;
        }
        for start in 0..=(n - task.block_size as usize) {
            let end = start + task.block_size as usize;
            let slots_free = occupied
                .map(|set| (start..end).all(|i| !set.contains(&(weekday, i))))
                .unwrap_or(true);
            if !slots_free {
                continue;
            }
            let merged_len = merged_run_length(
                day_entries,
                start,
                task.block_size as usize,
                &assignment.subject_id,
            );
            if merged_len > MAX_CONSECUTIVE_PERIODS as usize {
                continue;
            }
            let block_times: Vec<(String, String)> = (start..end)
                .map(|i| (slots[i].start.clone(), slots[i].end.clone()))
                .collect();
            for teacher_id in &assignment.teacher_ids {
                if teacher_ok(idx, state, teacher_id, weekday, &block_times) {
                    candidates.push(Candidate {
                        weekday,
                        start,
                        teacher_id: teacher_id.clone(),
                    });
                }
            }
        }
    }
    candidates
}

// The shared `No` prefix is meaningful here (each variant names a distinct
// "nothing found" reason for FR-16's report), not accidental repetition.
#[allow(clippy::enum_variant_names)]
enum DeadEndReason {
    NoTeachers,
    NoClassSlots,
    NoCommonAvailability,
}

fn classify_reason(
    idx: &Index,
    state: &SearchState,
    assignment: &Assignment,
    task: &Task,
) -> DeadEndReason {
    if assignment.teacher_ids.is_empty() {
        return DeadEndReason::NoTeachers;
    }
    let slots = idx.slots_of_class(&assignment.class_id);
    let n = slots.len();
    if task.block_size as usize > n {
        return DeadEndReason::NoClassSlots;
    }
    let by_day = state.class_day_subject.get(assignment.class_id.as_str());
    let occupied = state.class_slot_occupied.get(assignment.class_id.as_str());
    let empty_day: Vec<(usize, String)> = Vec::new();
    let mut any_free_ignoring_teacher = false;
    for &weekday in WEEKDAYS.iter() {
        let day_entries = by_day.and_then(|m| m.get(&weekday)).unwrap_or(&empty_day);
        let already = day_entries.iter().any(|(_, s)| s == &assignment.subject_id);
        if already && !assignment.allow_same_day_repetition {
            continue;
        }
        for start in 0..=(n - task.block_size as usize) {
            let end = start + task.block_size as usize;
            let free = occupied
                .map(|set| (start..end).all(|i| !set.contains(&(weekday, i))))
                .unwrap_or(true);
            if !free {
                continue;
            }
            let merged = merged_run_length(
                day_entries,
                start,
                task.block_size as usize,
                &assignment.subject_id,
            );
            if merged <= MAX_CONSECUTIVE_PERIODS as usize {
                any_free_ignoring_teacher = true;
            }
        }
    }
    if any_free_ignoring_teacher {
        DeadEndReason::NoCommonAvailability
    } else {
        DeadEndReason::NoClassSlots
    }
}

fn search(
    idx: &Index,
    input: &ScheduleInput,
    tasks: &[Task],
    task_idx: usize,
    state: &mut SearchState,
    deepest: &mut Option<(usize, DeadEndReason)>,
    budget: &mut u64,
) -> bool {
    if task_idx == tasks.len() {
        return true;
    }
    let task = &tasks[task_idx];
    let assignment = &input.assignments[task.assignment_index];
    let candidates = candidates_for_task(idx, state, task, assignment);
    if candidates.is_empty() {
        let reason = classify_reason(idx, state, assignment, task);
        if deepest.as_ref().map(|(i, _)| task_idx > *i).unwrap_or(true) {
            *deepest = Some((task_idx, reason));
        }
        return false;
    }
    for cand in candidates {
        if *budget == 0 {
            return false;
        }
        *budget -= 1;
        state.commit(idx, assignment, task, &cand);
        if search(idx, input, tasks, task_idx + 1, state, deepest, budget) {
            return true;
        }
        state.undo(assignment, task, &cand);
    }
    false
}

fn build_infeasibility_report(
    idx: &Index,
    input: &ScheduleInput,
    tasks: &[Task],
    deepest: &Option<(usize, DeadEndReason)>,
) -> InfeasibilityReport {
    let Some((task_idx, reason)) = deepest else {
        return InfeasibilityReport {
            message: "Não foi possível gerar um horário válido dentro do esforço de busca configurado; tente simplificar a configuração e gerar novamente.".to_string(),
            class_id: None,
            subject_id: None,
            teacher_ids: Vec::new(),
        };
    };
    let task = &tasks[*task_idx];
    let a = &input.assignments[task.assignment_index];
    let class_label = idx.class_label(&a.class_id);
    let subject_label = idx.subject_label(&a.subject_id);
    let teacher_names: Vec<String> = a.teacher_ids.iter().map(|t| idx.teacher_label(t)).collect();
    let message = match reason {
        DeadEndReason::NoTeachers => format!(
            "A disciplina {subject_label} da turma {class_label} não tem nenhum professor configurado."
        ),
        DeadEndReason::NoClassSlots => format!(
            "Não há horários livres suficientes na grade da turma {class_label} para alocar {subject_label}."
        ),
        DeadEndReason::NoCommonAvailability if teacher_names.len() == 1 => format!(
            "{}: nenhum horário disponível compatível com a turma {} para a disciplina {}.",
            teacher_names[0], class_label, subject_label
        ),
        DeadEndReason::NoCommonAvailability => format!(
            "Nenhum horário disponível em comum entre a turma {} e os professores configurados ({}) para a disciplina {}.",
            class_label,
            teacher_names.join(", "),
            subject_label
        ),
    };
    InfeasibilityReport {
        message,
        class_id: Some(a.class_id.clone()),
        subject_id: Some(a.subject_id.clone()),
        teacher_ids: a.teacher_ids.clone(),
    }
}

/// E06's "quick mode" (IMPL.md §5.5): run the Constructor once and return
/// either a fully verified feasible Schedule or FR-16's infeasibility
/// report. The time-boxed multi-candidate `generate(input, timeBudgetMs)`
/// (Refiner/Scorer, deep mode) arrives with E13 — see impls/DECISIONS.md.
pub fn generate_quick(input: &ScheduleInput) -> GenerateResult {
    let idx = Index::build(input);
    let tasks = build_tasks(input);
    let mut state = SearchState::default();
    let mut deepest: Option<(usize, DeadEndReason)> = None;
    let mut budget = SEARCH_BUDGET;
    if search(
        &idx,
        input,
        &tasks,
        0,
        &mut state,
        &mut deepest,
        &mut budget,
    ) {
        to_generate_result(
            input,
            Schedule {
                placements: state.schedule,
            },
        )
    } else {
        GenerateResult::Infeasible {
            reason: build_infeasibility_report(&idx, input, &tasks, &deepest),
        }
    }
}
