//! `verify(input, schedule) -> Vec<Violation>` (IMPL.md §4.1): checks a
//! candidate Schedule against every FR-14 hard constraint. Pure and
//! UI-independent (TR-11) — used standalone (manual-edit conflict flags,
//! FR-18) and internally by the Constructor to prune invalid placements.

use crate::model::{
    Assignment, GenerateResult, Index, MAX_CONSECUTIVE_PERIODS, PlacedPeriod, Schedule,
    ScheduleInput, Violation, Weekday, ranges_overlap,
};
use std::collections::HashMap;

/// A placement with its Class-relative period position and real clock time
/// resolved — owned (not borrowed) to keep the checks below free of
/// lifetime bookkeeping at this data scale (TR-10).
struct Resolved {
    class_id: String,
    subject_id: String,
    teacher_id: String,
    weekday: Weekday,
    slot_index: usize,
    start: String,
    end: String,
}

fn resolve(idx: &Index, schedule: &Schedule) -> Vec<Resolved> {
    schedule
        .placements
        .iter()
        .filter_map(|p: &PlacedPeriod| {
            let slots = idx.slots_of_class(&p.class_id);
            let (slot_index, slot) = slots
                .iter()
                .enumerate()
                .find(|(_, s)| s.id == p.time_slot_id)?;
            Some(Resolved {
                class_id: p.class_id.clone(),
                subject_id: p.subject_id.clone(),
                teacher_id: p.teacher_id.clone(),
                weekday: p.weekday,
                slot_index,
                start: slot.start.clone(),
                end: slot.end.clone(),
            })
        })
        .collect()
}

pub fn verify(input: &ScheduleInput, schedule: &Schedule) -> Vec<Violation> {
    let idx = Index::build(input);
    let resolved = resolve(&idx, schedule);
    let mut violations = Vec::new();

    check_class_double_booking(&idx, &resolved, &mut violations);
    check_teacher_double_booking(&idx, &resolved, &mut violations);
    check_occurrence_counts(&idx, input, schedule, &mut violations);
    check_teacher_availability(&idx, &resolved, &mut violations);
    check_teacher_limits(&idx, &resolved, &mut violations);
    check_runs(&idx, input, &resolved, &mut violations);

    violations
}

fn check_class_double_booking(idx: &Index, resolved: &[Resolved], out: &mut Vec<Violation>) {
    let mut seen: HashMap<(String, Weekday, usize), bool> = HashMap::new();
    for r in resolved {
        let key = (r.class_id.clone(), r.weekday, r.slot_index);
        if seen.insert(key, true).is_some() {
            out.push(Violation::ClassDoubleBooked {
                class_id: r.class_id.clone(),
                weekday: r.weekday,
                time_slot_id: idx
                    .slots_of_class(&r.class_id)
                    .get(r.slot_index)
                    .map(|s| s.id.clone())
                    .unwrap_or_default(),
                message: format!(
                    "A turma {} tem duas disciplinas no mesmo horário ({}, {}–{}).",
                    idx.class_label(&r.class_id),
                    r.weekday.label_ptbr(),
                    r.start,
                    r.end
                ),
            });
        }
    }
}

fn check_teacher_double_booking(idx: &Index, resolved: &[Resolved], out: &mut Vec<Violation>) {
    let mut by_teacher_day: HashMap<(String, Weekday), Vec<&Resolved>> = HashMap::new();
    for r in resolved {
        by_teacher_day
            .entry((r.teacher_id.clone(), r.weekday))
            .or_default()
            .push(r);
    }
    // D-01: a Teacher can teach across Segments, so this compares real
    // clock-time overlap, not per-Segment slot-index equality.
    for ((teacher_id, weekday), items) in by_teacher_day {
        for i in 0..items.len() {
            for j in (i + 1)..items.len() {
                if ranges_overlap(
                    &items[i].start,
                    &items[i].end,
                    &items[j].start,
                    &items[j].end,
                ) {
                    out.push(Violation::TeacherDoubleBooked {
                        teacher_id: teacher_id.clone(),
                        weekday,
                        message: format!(
                            "O professor {} está alocado em dois horários que se sobrepõem na {} ({}–{} e {}–{}).",
                            idx.teacher_label(&teacher_id),
                            weekday.label_ptbr(),
                            items[i].start,
                            items[i].end,
                            items[j].start,
                            items[j].end
                        ),
                    });
                }
            }
        }
    }
}

fn check_occurrence_counts(
    idx: &Index,
    input: &ScheduleInput,
    schedule: &Schedule,
    out: &mut Vec<Violation>,
) {
    for a in &input.assignments {
        let actual = schedule
            .placements
            .iter()
            .filter(|p| p.class_id == a.class_id && p.subject_id == a.subject_id)
            .count() as u32;
        if actual != a.weekly_occurrences {
            out.push(Violation::OccurrenceCountMismatch {
                assignment_id: a.id.clone(),
                class_id: a.class_id.clone(),
                subject_id: a.subject_id.clone(),
                required: a.weekly_occurrences,
                actual,
                message: format!(
                    "A turma {} deveria ter {} aula(s) de {} por semana, mas tem {}.",
                    idx.class_label(&a.class_id),
                    a.weekly_occurrences,
                    idx.subject_label(&a.subject_id),
                    actual
                ),
            });
        }
    }
}

fn check_teacher_availability(idx: &Index, resolved: &[Resolved], out: &mut Vec<Violation>) {
    for r in resolved {
        let Some(teacher) = idx.teacher_by_id.get(r.teacher_id.as_str()) else {
            continue;
        };
        // D-11: no matching UnavailabilityRange means available.
        let blocked = teacher
            .unavailability
            .iter()
            .any(|u| u.weekday == r.weekday && ranges_overlap(&u.start, &u.end, &r.start, &r.end));
        if blocked {
            out.push(Violation::TeacherUnavailable {
                teacher_id: r.teacher_id.clone(),
                class_id: r.class_id.clone(),
                weekday: r.weekday,
                time_slot_id: idx
                    .slots_of_class(&r.class_id)
                    .get(r.slot_index)
                    .map(|s| s.id.clone())
                    .unwrap_or_default(),
                message: format!(
                    "O professor {} não está disponível na {} das {} às {}, mas está alocado com a turma {}.",
                    idx.teacher_label(&r.teacher_id),
                    r.weekday.label_ptbr(),
                    r.start,
                    r.end,
                    idx.class_label(&r.class_id)
                ),
            });
        }
    }
}

/// FR-11: optional per-Teacher daily/consecutive-period limits. "Consecutive"
/// is defined by real clock-time adjacency (back-to-back, zero gap), not
/// Segment-scoped slot indices, consistent with D-01 — a Teacher's day can
/// span Segments with different period grids.
fn check_teacher_limits(idx: &Index, resolved: &[Resolved], out: &mut Vec<Violation>) {
    let mut by_teacher_day: HashMap<(String, Weekday), Vec<&Resolved>> = HashMap::new();
    for r in resolved {
        by_teacher_day
            .entry((r.teacher_id.clone(), r.weekday))
            .or_default()
            .push(r);
    }
    for ((teacher_id, weekday), mut items) in by_teacher_day {
        items.sort_by(|a, b| a.start.cmp(&b.start));
        let Some(teacher) = idx.teacher_by_id.get(teacher_id.as_str()) else {
            continue;
        };

        if let Some(max_daily) = teacher.max_periods_per_day
            && items.len() as u32 > max_daily
        {
            out.push(Violation::TeacherDailyLimitExceeded {
                teacher_id: teacher_id.clone(),
                weekday,
                message: format!(
                    "O professor {} tem {} aula(s) na {}, acima do limite diário de {}.",
                    idx.teacher_label(&teacher_id),
                    items.len(),
                    weekday.label_ptbr(),
                    max_daily
                ),
            });
        }

        if teacher.min_consecutive_periods.is_none() && teacher.max_consecutive_periods.is_none() {
            continue;
        }
        let mut run_len: usize = 1;
        let mut run_lengths = Vec::new();
        for w in items.windows(2) {
            if w[0].end == w[1].start {
                run_len += 1;
            } else {
                run_lengths.push(run_len);
                run_len = 1;
            }
        }
        run_lengths.push(run_len);

        for len in run_lengths {
            if let Some(max_c) = teacher.max_consecutive_periods
                && len as u32 > max_c
            {
                out.push(Violation::TeacherConsecutiveLimitViolated {
                    teacher_id: teacher_id.clone(),
                    weekday,
                    message: format!(
                        "O professor {} tem um bloco de {} aulas consecutivas na {}, acima do máximo configurado de {}.",
                        idx.teacher_label(&teacher_id),
                        len,
                        weekday.label_ptbr(),
                        max_c
                    ),
                });
            }
            if let Some(min_c) = teacher.min_consecutive_periods
                && (len as u32) < min_c
            {
                out.push(Violation::TeacherConsecutiveLimitViolated {
                    teacher_id: teacher_id.clone(),
                    weekday,
                    message: format!(
                        "O professor {} tem um bloco de apenas {} aula(s) consecutiva(s) na {}, abaixo do mínimo configurado de {}.",
                        idx.teacher_label(&teacher_id),
                        len,
                        weekday.label_ptbr(),
                        min_c
                    ),
                });
            }
        }
    }
}

/// Maximal runs of contiguous slot indices, e.g. `[0, 1, 2, 4]` -> `[(0,3), (4,1)]`.
fn compute_runs(sorted_unique_indices: &[usize]) -> Vec<(usize, usize)> {
    let mut runs = Vec::new();
    let mut i = 0;
    while i < sorted_unique_indices.len() {
        let start = sorted_unique_indices[i];
        let mut len = 1;
        while i + 1 < sorted_unique_indices.len()
            && sorted_unique_indices[i + 1] == sorted_unique_indices[i] + 1
        {
            i += 1;
            len += 1;
        }
        runs.push((start, len));
        i += 1;
    }
    runs
}

/// Three checks that all key off the same "maximal contiguous same-(Class,
/// Subject) run per weekday" computation: the 3-period ceiling (FR-10), the
/// double/triple block actually being consecutive (FR-14), and same-day
/// repetition (FR-12, D-13-style precise definition: more than one run on a
/// day for a (Class, Subject) that hasn't opted in).
fn check_runs(idx: &Index, input: &ScheduleInput, resolved: &[Resolved], out: &mut Vec<Violation>) {
    let mut by_key: HashMap<(String, String, Weekday), Vec<usize>> = HashMap::new();
    for r in resolved {
        by_key
            .entry((r.class_id.clone(), r.subject_id.clone(), r.weekday))
            .or_default()
            .push(r.slot_index);
    }

    let assignment_by_cs: HashMap<(&str, &str), &Assignment> = input
        .assignments
        .iter()
        .map(|a| ((a.class_id.as_str(), a.subject_id.as_str()), a))
        .collect();

    let mut run_lengths_by_assignment: HashMap<(String, String), Vec<usize>> = HashMap::new();

    for ((class_id, subject_id, weekday), mut indices) in by_key {
        indices.sort_unstable();
        indices.dedup();
        let runs = compute_runs(&indices);

        for &(_, len) in &runs {
            if len > MAX_CONSECUTIVE_PERIODS as usize {
                out.push(Violation::ConsecutiveCeilingExceeded {
                    class_id: class_id.clone(),
                    subject_id: subject_id.clone(),
                    weekday,
                    run_length: len,
                    message: format!(
                        "A turma {} tem {} aulas seguidas de {} na {}, acima do limite de {}.",
                        idx.class_label(&class_id),
                        len,
                        idx.subject_label(&subject_id),
                        weekday.label_ptbr(),
                        MAX_CONSECUTIVE_PERIODS
                    ),
                });
            }
        }

        if let Some(assignment) = assignment_by_cs.get(&(class_id.as_str(), subject_id.as_str()))
            && !assignment.allow_same_day_repetition
            && runs.len() > 1
        {
            out.push(Violation::SameDayRepetition {
                assignment_id: assignment.id.clone(),
                class_id: class_id.clone(),
                subject_id: subject_id.clone(),
                weekday,
                message: format!(
                    "A turma {} tem {} na {} em horários não consecutivos, e repetição no mesmo dia não está habilitada para esta disciplina.",
                    idx.class_label(&class_id),
                    idx.subject_label(&subject_id),
                    weekday.label_ptbr()
                ),
            });
        }

        run_lengths_by_assignment
            .entry((class_id, subject_id))
            .or_default()
            .extend(runs.iter().map(|&(_, len)| len));
    }

    for a in &input.assignments {
        if a.consecutive_periods <= 1 {
            continue;
        }
        let expected_blocks = a.weekly_occurrences / a.consecutive_periods;
        if expected_blocks == 0 {
            continue;
        }
        let lens = run_lengths_by_assignment
            .get(&(a.class_id.clone(), a.subject_id.clone()))
            .cloned()
            .unwrap_or_default();
        let satisfied = lens
            .iter()
            .filter(|&&len| len >= a.consecutive_periods as usize)
            .count() as u32;
        if satisfied < expected_blocks {
            out.push(Violation::ConsecutiveBlockBroken {
                assignment_id: a.id.clone(),
                class_id: a.class_id.clone(),
                subject_id: a.subject_id.clone(),
                message: format!(
                    "A disciplina {} da turma {} deveria ter {} bloco(s) de {} aulas consecutivas por semana, mas apenas {} foi(ram) encontrado(s).",
                    idx.subject_label(&a.subject_id),
                    idx.class_label(&a.class_id),
                    expected_blocks,
                    a.consecutive_periods,
                    satisfied
                ),
            });
        }
    }
}

/// Used by `generateQuick`'s WASM wrapper to shape a feasible schedule into
/// the same `GenerateResult` the Constructor returns on failure, i.e. a
/// belt-and-braces re-verification before reporting success.
pub fn to_generate_result(input: &ScheduleInput, schedule: Schedule) -> GenerateResult {
    let violations = verify(input, &schedule);
    if violations.is_empty() {
        GenerateResult::Feasible { schedule }
    } else {
        GenerateResult::Infeasible {
            reason: crate::model::InfeasibilityReport {
                message: format!(
                    "O horário gerado não é válido ({} violação(ões) detectada(s)); tente novamente.",
                    violations.len()
                ),
                class_id: None,
                subject_id: None,
                teacher_ids: Vec::new(),
            },
        }
    }
}
