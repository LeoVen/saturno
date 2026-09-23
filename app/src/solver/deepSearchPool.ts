// IMPL.md §5.2 (E13-T3): the Worker pool for deep-mode generation. Spawns
// N independent `solver.worker.ts` instances (each gets its own WASM module
// instance for free — Workers share no memory, no SharedArrayBuffer, no
// cross-origin-isolation header requirement, per §5.2's own reasoning), each
// running its own Constructor + Refiner pass from a distinct RNG seed.
//
// Progress streaming/cancellation (§5.3) is E13-T4's job — this module just
// spawns the pool, sends one `generateDeep` request per Worker, waits for
// every one to finish, and tears the pool down. Merging/ranking/
// deduplication across Workers' results (§5.4, the Coordinator in §3) is
// E13-T5/T6's job, not this module's — results are returned per-Worker,
// unmerged.

import type {
  Candidate,
  GenerateDeepResult,
  InfeasibilityReport,
  ScheduleInput,
} from '../wasm/types'
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

/**
 * Runs one deep-search pass across a fresh pool of Workers, each
 * independently running the Constructor once and then `iterations` Refiner
 * proposal attempts from its own seed (`solver/src/lib.rs`'s `generateDeep`,
 * E13-T3's provisional, not-yet-time-boxed shape). Every spawned Worker is
 * terminated before this resolves — no pool is kept warm between calls
 * (E13-T4, once progress/cancellation exist, may find a longer-lived pool
 * worth it; not needed for this task).
 *
 * The Constructor phase is itself deterministic (no randomness), so an
 * infeasible `input` is reported identically by every Worker — the first
 * one encountered is returned rather than waiting to compare all of them.
 */
export async function runDeepSearchPool(
  input: ScheduleInput,
  iterations: number,
): Promise<PoolRunResult> {
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

  try {
    const results = await Promise.all(
      workers.map((worker, i) => runOnWorker(worker, clonedInput, randomSeed(), iterations, i)),
    )

    const infeasible = results.find(
      (r): r is { status: 'infeasible'; reason: InfeasibilityReport } => r.status === 'infeasible',
    )
    if (infeasible) {
      return { status: 'infeasible', reason: infeasible.reason }
    }
    const candidatesByWorker = results.map((r) => (r.status === 'feasible' ? r.candidates : []))
    return { status: 'feasible', candidatesByWorker }
  } finally {
    for (const worker of workers) worker.terminate()
  }
}

function runOnWorker(
  worker: Worker,
  input: ScheduleInput,
  seed: number,
  iterations: number,
  requestId: number,
): Promise<GenerateDeepResult> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
      const message = event.data
      if (message.type === 'error') {
        reject(new Error(message.message))
        return
      }
      if (message.type !== 'generateDeep') {
        reject(new Error('Resposta inesperada do solver.'))
        return
      }
      resolve(message.result)
    }
    worker.onerror = (event: ErrorEvent) => reject(new Error(event.message))
    const request: SolverWorkerRequest = {
      type: 'generateDeep',
      requestId,
      input,
      seed,
      iterations,
    }
    worker.postMessage(request)
  })
}
