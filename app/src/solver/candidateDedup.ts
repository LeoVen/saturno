// IMPL.md §5.4 (E13-T5): "the coordinator drops near-duplicate candidates
// (e.g. Hamming distance between two candidates' assignment grids below a
// threshold), so the ranked list shown to the user (FR-32) is meaningfully
// diverse rather than trivial permutations of the same schedule." Lives in
// the TS Coordinator per IMPL.md §3's architecture diagram ("Coordinator
// merges, deduplicates (§5.4), and ranks all candidates") — not in Rust/wasm
// — so this is a plain, directly unit-testable pure function (TR-11), not
// something that needs the headless-Chromium verification T3/T4's
// Worker/wasm-boundary code did.
//
// Pure and UI-independent: no DOM, no Worker, no store access.

import type { Candidate, PlacedPeriod, Schedule } from '../wasm/types'

/**
 * D-54: no spec-mandated number — IMPL.md §10 explicitly flags the
 * threshold as needing empirical tuning "once real candidate schedules
 * exist to compare." A *fraction* of the compared schedules' own slot
 * count (not an absolute placement-count difference), so it scales
 * sensibly across a small school's schedule and a large one's without
 * being separately tuned per school size — two candidates count as
 * near-duplicates when fewer than 5% of their (Class, weekday, Time Slot)
 * combinations actually differ.
 */
export const DEFAULT_DEDUP_THRESHOLD_FRACTION = 0.05

/** `${classId}|${weekday}|${timeSlotId}` -> `${subjectId}|${teacherId}` for every placement — the "assignment grid" IMPL.md §5.4 means, deliberately excluding `jointSessionPlacements` (identical across every candidate of one run, per FR-25/D-51 — the Refiner never touches them, so they'd never contribute to the distance regardless). */
function scheduleSignature(schedule: Schedule): Map<string, string> {
  const signature = new Map<string, string>()
  for (const p of schedule.placements) {
    signature.set(slotKey(p), `${p.subjectId}|${p.teacherId}`)
  }
  return signature
}

function slotKey(p: PlacedPeriod): string {
  return `${p.classId}|${p.weekday}|${p.timeSlotId}`
}

/**
 * Hamming distance between two Schedules' assignment grids (IMPL.md §5.4),
 * as a fraction of the union of every (Class, weekday, Time Slot)
 * combination either one places something in — 0 means identical, 1 means
 * they share no (slot, Subject, Teacher) in common at all. Two schedules
 * with no placements at all (a degenerate case no real Candidate reaches)
 * count as identical (distance 0) rather than dividing by zero.
 */
export function scheduleDistanceFraction(a: Schedule, b: Schedule): number {
  const sigA = scheduleSignature(a)
  const sigB = scheduleSignature(b)
  const keys = new Set([...sigA.keys(), ...sigB.keys()])
  if (keys.size === 0) return 0

  let differing = 0
  for (const key of keys) {
    if (sigA.get(key) !== sigB.get(key)) differing++
  }
  return differing / keys.size
}

/**
 * Drops near-duplicate Candidates, keeping the better-scoring
 * representative of each cluster (IMPL.md §5.4). Greedy: Candidates are
 * considered best-score-first (`score.total`, lower is better — D-51),
 * and a Candidate is dropped as soon as it's within `thresholdFraction` of
 * any Candidate already kept — never compared against a Candidate that
 * was itself dropped, so a long chain of near-duplicates collapses to
 * just its best member rather than keeping one per adjacent pair.
 */
export function dedupeCandidates(
  candidates: Candidate[],
  thresholdFraction: number = DEFAULT_DEDUP_THRESHOLD_FRACTION,
): Candidate[] {
  const byScoreAscending = [...candidates].sort((a, b) => a.score.total - b.score.total)
  const kept: Candidate[] = []

  for (const candidate of byScoreAscending) {
    const isNearDuplicate = kept.some(
      (k) => scheduleDistanceFraction(k.schedule, candidate.schedule) < thresholdFraction,
    )
    if (!isNearDuplicate) kept.push(candidate)
  }

  return kept
}
