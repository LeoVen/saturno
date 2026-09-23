// IMPL.md §5.2/§5.3 (E13-T3/T4): the Worker pool for deep-mode generation.
// Spawns N independent `solver.worker.ts` instances (each gets its own WASM
// module instance for free — Workers share no memory, no
// SharedArrayBuffer, no cross-origin-isolation header requirement, per
// §5.2's own reasoning), each running its own Constructor + Refiner
// session from a distinct RNG seed, streaming progress back slice-by-slice
// and stoppable early (FR-34).
//
// Merging/ranking/deduplication across Workers' results (§5.4, the
// Coordinator in §3) is E13-T5/T6's job, not this module's — the final
// result is per-Worker, unmerged.

import type { Candidate, InfeasibilityReport, ScheduleInput, SliceResult } from '../wasm/types'
import type { SolverWorkerRequest, SolverWorkerResponse } from '../wasm/solver.worker'

/**
 * IMPL.md §5.2: "capped at a sane maximum, e.g. 6-8" — 6 chosen (the more
 * conservative end, leaves the main thread more responsive on typical
 * hardware) as a first default; IMPL.md §10 itself flags this as a guess to
 * be tuned once there's a real build to profile. See impls/DECISIONS.md.
 */
const POOL_SIZE_CAP = 6

/** `navigator.hardwareConcurrency` is 0 in a few real browser configs and always absent outside a browser (e.g. this module's own tests) — 4 is a reasonable fallback, not a spec-mandated number. */
const FALLBACK_CORE_COUNT = 4

export function poolSize(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  return Math.max(1, Math.min(cores || FALLBACK_CORE_COUNT, POOL_SIZE_CAP))
}

/** A fresh, genuinely random 32-bit seed per Worker (IMPL.md §5.2: "a distinct RNG seed") — intentionally not reproducible run-to-run (that determinism guarantee belongs to `solver/src/refiner.rs`'s own tests, given a fixed seed); each real run should actually explore differently. */
function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]!
}

export type PoolRunResult =
  | { status: 'infeasible'; reason: InfeasibilityReport }
  | { status: 'feasible'; candidatesByWorker: Candidate[][] }

/** FR-34: "how many valid candidates have been found so far, and the best score found so far" — aggregated across the whole pool, not per-Worker (the UI, E13-T7, shows one overall picture). `bestTotal` is `null` until at least one Worker has reported one. */
export interface DeepSearchProgress {
  elapsedMs: number
  bestTotal: number | null
  candidatesFound: number
  done: boolean
}

export interface DeepSearchHandle {
  /** FR-34: cancel anytime, keeping whatever candidates were found so far — `result` still resolves normally, just sooner, with fewer/no candidates from Workers that hadn't found one yet. */
  cancel: () => void
  result: Promise<PoolRunResult>
}

/**
 * Starts one deep-search pass across a fresh pool of Workers, each
 * independently running the Constructor once and then a `RefineSession`
 * (`solver/src/lib.rs`'s `DeepSearchSession`) time-boxed to `timeBudgetMs`
 * (FR-32), streaming progress via `onProgress` as Workers report slices
 * (IMPL.md §5.3). Every spawned Worker is terminated once `result` settles
 * — no pool is kept warm between calls (a longer-lived pool isn't needed
 * for anything today).
 *
 * The Constructor phase is itself deterministic (no randomness), so an
 * infeasible `input` is reported identically by every Worker — the first
 * one encountered settles `result` immediately, cancelling the rest.
 */
export function startDeepSearchPool(
  input: ScheduleInput,
  timeBudgetMs: number,
  onProgress?: (progress: DeepSearchProgress) => void,
): DeepSearchHandle {
  // Structured-clone through JSON before it crosses any Worker boundary —
  // same reasoning as `generationCoordinator.ts`'s `buildScheduleInput`
  // (the caller's `input` may be built from Pinia-reactive state). One
  // clone is safely reused across every `postMessage` call below: each
  // call performs its own independent structured clone of it, and nothing
  // here is a Transferable.
  const clonedInput = JSON.parse(JSON.stringify(input)) as ScheduleInput

  const size = poolSize()
  const workers: Worker[] = Array.from(
    { length: size },
    () => new Worker(new URL('../wasm/solver.worker.ts', import.meta.url), { type: 'module' }),
  )

  const startedAt = performance.now()
  const candidatesByWorker: Candidate[][] = Array.from({ length: size }, () => [])
  const workerDone: boolean[] = new Array(size).fill(false)
  let infeasibleReason: InfeasibilityReport | null = null
  let bestTotal: number | null = null
  let settled = false

  let resolveResult!: (value: PoolRunResult) => void
  let rejectResult!: (reason: Error) => void
  const result = new Promise<PoolRunResult>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })

  function terminateAll(): void {
    for (const worker of workers) worker.terminate()
  }

  function emitProgress(): void {
    if (!onProgress || settled) return
    const candidatesFound = candidatesByWorker.reduce((sum, list) => sum + list.length, 0)
    onProgress({
      elapsedMs: performance.now() - startedAt,
      bestTotal,
      candidatesFound,
      done: workerDone.every(Boolean),
    })
  }

  function finishIfReady(): void {
    if (settled) return
    if (infeasibleReason) {
      settled = true
      resolveResult({ status: 'infeasible', reason: infeasibleReason })
      terminateAll()
      return
    }
    if (workerDone.every(Boolean)) {
      settled = true
      resolveResult({ status: 'feasible', candidatesByWorker })
      terminateAll()
    }
  }

  function fail(error: Error): void {
    if (settled) return
    settled = true
    rejectResult(error)
    terminateAll()
  }

  workers.forEach((worker, i) => {
    worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
      const message = event.data
      if (message.type === 'error') {
        fail(new Error(message.message))
        return
      }
      if (message.type !== 'deepSearchProgress') return

      const sliceResult: SliceResult = message.result
      if (sliceResult.status === 'infeasible') {
        infeasibleReason ??= sliceResult.reason
        workerDone[i] = true
      } else {
        candidatesByWorker[i].push(...sliceResult.newCandidates)
        if (bestTotal === null || sliceResult.bestTotal < bestTotal)
          bestTotal = sliceResult.bestTotal
        workerDone[i] = sliceResult.done
      }
      emitProgress()
      finishIfReady()
    }
    worker.onerror = (event: ErrorEvent) => fail(new Error(event.message))

    const request: SolverWorkerRequest = {
      type: 'startDeepSearch',
      requestId: i,
      input: clonedInput,
      seed: randomSeed(),
      timeBudgetMs,
    }
    worker.postMessage(request)
  })

  function cancel(): void {
    workers.forEach((worker, i) => {
      const request: SolverWorkerRequest = { type: 'cancelDeepSearch', requestId: i }
      worker.postMessage(request)
    })
  }

  return { cancel, result }
}
