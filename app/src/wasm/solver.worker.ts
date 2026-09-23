/// <reference lib="webworker" />

// TR-3: the solver runs inside a single dedicated Web Worker, off the main
// thread. E06 wires the quick-generation path (IMPL.md §5.5). E13-T1 adds
// `score` here too (standalone, not just internal to the Refiner). E13-T4
// adds `startDeepSearch`/`cancelDeepSearch` (IMPL.md §4.3/§5.1/§5.2/§5.3:
// Constructor + a resumable Refiner session, driven slice-by-slice with
// `postMessage`d progress and a locally-checked cancellation flag — see
// D-53) — this same file is what the pool (`deepSearchPool.ts`) spawns N
// independent instances of, each getting its own WASM module instance for
// free (Workers share no memory), rather than a separate worker file.

import init, { DeepSearchSession, generateQuick, score, verify } from './pkg/solver.js'
import type {
  GenerateResult,
  Schedule,
  ScheduleInput,
  ScoreBreakdown,
  SliceResult,
  Violation,
} from './types'

export type SolverWorkerRequest =
  | { type: 'generateQuick'; requestId: number; input: ScheduleInput }
  | { type: 'verify'; requestId: number; input: ScheduleInput; schedule: Schedule }
  | { type: 'score'; requestId: number; input: ScheduleInput; schedule: Schedule }
  | {
      type: 'startDeepSearch'
      requestId: number
      input: ScheduleInput
      seed: number
      timeBudgetMs: number
    }
  | { type: 'cancelDeepSearch'; requestId: number }

export type SolverWorkerResponse =
  | { type: 'generateQuick'; requestId: number; result: GenerateResult }
  | { type: 'verify'; requestId: number; violations: Violation[] }
  | { type: 'score'; requestId: number; breakdown: ScoreBreakdown }
  | { type: 'deepSearchProgress'; requestId: number; result: SliceResult }
  | { type: 'error'; requestId: number; message: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

let ready: Promise<void> | null = null
function ensureReady(): Promise<void> {
  if (!ready) {
    ready = init().then(() => undefined)
  }
  return ready
}

// IMPL.md §5.3: "a plain boolean the coordinator can set via postMessage,
// checked at the top of the next slice" — keyed by requestId (matching the
// `startDeepSearch` that began the run) so a stray/late cancel for a
// different run can't affect this one.
const cancelledRequests = new Set<number>()

/** D-53: `runSlice` itself never reads a clock — this loop is what actually measures wall time (`performance.now()`) and adaptively sizes each slice to land close to `SLICE_TARGET_MS`, since how many iterations take ~100ms varies by hardware and can't be hardcoded. */
const SLICE_TARGET_MS = 100
const INITIAL_SLICE_ITERATIONS = 200
const MIN_SLICE_ITERATIONS = 20
const MAX_SLICE_ITERATIONS = 20_000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function yieldToEventLoop(): Promise<void> {
  // IMPL.md §5.3: "yielding control back to the Worker's message loop" —
  // a macrotask boundary (not just a microtask/`Promise.resolve()`) is
  // what actually lets a pending `postMessage`-delivered 'cancelDeepSearch'
  // get dispatched before the next slice starts.
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function runDeepSearch(
  input: ScheduleInput,
  seed: number,
  timeBudgetMs: number,
  requestId: number,
): Promise<void> {
  const session = new DeepSearchSession(input, seed, timeBudgetMs)
  const startedAt = performance.now()
  let iterations = INITIAL_SLICE_ITERATIONS
  // Rare edge case: cancelled before the very first slice ever reports a
  // real `bestTotal` — 0 is a placeholder, not a claim anything was found.
  let lastBestTotal = 0

  try {
    while (true) {
      if (cancelledRequests.has(requestId)) {
        // `runSlice` has no notion of cancellation (D-53) — this Worker
        // must report `done: true` on cancellation's own behalf, or the
        // pool coordinator's "every Worker done" check would hang forever
        // waiting for a final message that would otherwise never come.
        const response: SolverWorkerResponse = {
          type: 'deepSearchProgress',
          requestId,
          result: { status: 'progress', newCandidates: [], bestTotal: lastBestTotal, done: true },
        }
        ctx.postMessage(response)
        break
      }

      const elapsedMs = performance.now() - startedAt
      const sliceStart = performance.now()
      const result = session.runSlice(elapsedMs, iterations) as SliceResult
      const sliceActualMs = performance.now() - sliceStart
      if (result.status === 'progress') lastBestTotal = result.bestTotal

      const response: SolverWorkerResponse = { type: 'deepSearchProgress', requestId, result }
      ctx.postMessage(response)

      if (result.status === 'infeasible' || result.done) break

      if (sliceActualMs > 0) {
        iterations = clamp(
          Math.round(iterations * (SLICE_TARGET_MS / sliceActualMs)),
          MIN_SLICE_ITERATIONS,
          MAX_SLICE_ITERATIONS,
        )
      }
      await yieldToEventLoop()
    }
  } finally {
    cancelledRequests.delete(requestId)
    session.free()
  }
}

ctx.onmessage = async (event: MessageEvent<SolverWorkerRequest>) => {
  const message = event.data
  if (message.type === 'cancelDeepSearch') {
    cancelledRequests.add(message.requestId)
    return
  }
  try {
    await ensureReady()
    if (message.type === 'generateQuick') {
      const result = generateQuick(message.input) as GenerateResult
      const response: SolverWorkerResponse = {
        type: 'generateQuick',
        requestId: message.requestId,
        result,
      }
      ctx.postMessage(response)
    } else if (message.type === 'verify') {
      const violations = verify(message.input, message.schedule) as Violation[]
      const response: SolverWorkerResponse = {
        type: 'verify',
        requestId: message.requestId,
        violations,
      }
      ctx.postMessage(response)
    } else if (message.type === 'score') {
      const breakdown = score(message.input, message.schedule) as ScoreBreakdown
      const response: SolverWorkerResponse = {
        type: 'score',
        requestId: message.requestId,
        breakdown,
      }
      ctx.postMessage(response)
    } else if (message.type === 'startDeepSearch') {
      await runDeepSearch(message.input, message.seed, message.timeBudgetMs, message.requestId)
    }
  } catch (err) {
    const response: SolverWorkerResponse = {
      type: 'error',
      requestId: message.requestId,
      message: err instanceof Error ? err.message : String(err),
    }
    ctx.postMessage(response)
  }
}
