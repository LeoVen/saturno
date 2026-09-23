// IMPL.md §3's "Generation Coordinator": the one entry point the UI
// (E13-T7) calls to run a Deep Search. `deepSearchPool.ts` (E13-T3/T4) owns
// the Worker pool and progress streaming/cancellation; this module is the
// thin layer on top that turns its raw, unmerged, per-Worker result into
// what FR-32 actually promises the user — "a ranked list" of "distinct"
// candidates — by merging every Worker's finds, deduplicating (E13-T5),
// and ranking by score once the run finishes.

import { dedupeCandidates } from './candidateDedup'
import { startDeepSearchPool } from './deepSearchPool'
import type { DeepSearchProgress, PoolRunResult } from './deepSearchPool'
import type { Candidate, InfeasibilityReport, ScheduleInput } from '../wasm/types'

export type DeepSearchResult =
  | { status: 'infeasible'; reason: InfeasibilityReport }
  | { status: 'feasible'; candidates: Candidate[] }

export interface DeepSearchHandle {
  cancel: () => void
  result: Promise<DeepSearchResult>
}

/**
 * Merges every Worker's candidates into one list, drops near-duplicates
 * across the *whole* merged set (E13-T5 — not just within a single
 * Worker's own finds, since two Workers exploring from different seeds
 * can easily converge on the same or near-identical schedule), and ranks
 * what's left by `score.total` ascending (FR-15/FR-32 — lower is better,
 * D-51) — this is FR-32's "ranked list of distinct... candidates."
 *
 * Pure and directly testable, unlike `startDeepSearch` below (which needs
 * a real Worker pool) — the actual merge/dedup/rank logic lives here so
 * it doesn't need a browser to verify.
 */
export function rankCandidates(candidatesByWorker: Candidate[][]): Candidate[] {
  const merged = candidatesByWorker.flat()
  const deduped = dedupeCandidates(merged)
  return [...deduped].sort((a, b) => a.score.total - b.score.total)
}

function toDeepSearchResult(poolResult: PoolRunResult): DeepSearchResult {
  if (poolResult.status === 'infeasible') {
    return { status: 'infeasible', reason: poolResult.reason }
  }
  return { status: 'feasible', candidates: rankCandidates(poolResult.candidatesByWorker) }
}

/**
 * Starts one Deep Search run (FR-32/33/34): spawns the Worker pool
 * (E13-T3), streams live progress via `onProgress` as Workers report
 * slices (E13-T4, unchanged pass-through — FR-34 only asks for a count
 * and the best score so far while running, not the full ranked list mid-
 * run), and resolves `result` with the final merged/deduplicated/ranked
 * candidate list once every Worker is done (or the shared
 * `InfeasibilityReport` if the Constructor phase itself failed).
 * `cancel()` stops early, keeping whatever was found (FR-34).
 */
export function startDeepSearch(
  input: ScheduleInput,
  timeBudgetMs: number,
  onProgress?: (progress: DeepSearchProgress) => void,
): DeepSearchHandle {
  const pool = startDeepSearchPool(input, timeBudgetMs, onProgress)
  return {
    cancel: pool.cancel,
    result: pool.result.then(toDeepSearchResult),
  }
}
