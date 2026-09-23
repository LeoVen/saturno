/// <reference lib="webworker" />

// TR-3: the solver runs inside a single dedicated Web Worker, off the main
// thread. E06 wires the quick-generation path (IMPL.md §5.5) — the Worker
// pool for deep mode (IMPL.md §5.2) arrives with E13. E13-T1 adds `score`
// here too (standalone, not just internal to the eventual Refiner) — still
// through this single Worker; the pool itself is a separate module (E13-T3).

import init, { generateQuick, score, verify } from './pkg/solver.js'
import type { GenerateResult, Schedule, ScheduleInput, ScoreBreakdown, Violation } from './types'

export type SolverWorkerRequest =
  | { type: 'generateQuick'; requestId: number; input: ScheduleInput }
  | { type: 'verify'; requestId: number; input: ScheduleInput; schedule: Schedule }
  | { type: 'score'; requestId: number; input: ScheduleInput; schedule: Schedule }

export type SolverWorkerResponse =
  | { type: 'generateQuick'; requestId: number; result: GenerateResult }
  | { type: 'verify'; requestId: number; violations: Violation[] }
  | { type: 'score'; requestId: number; breakdown: ScoreBreakdown }
  | { type: 'error'; requestId: number; message: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

let ready: Promise<void> | null = null
function ensureReady(): Promise<void> {
  if (!ready) {
    ready = init().then(() => undefined)
  }
  return ready
}

ctx.onmessage = async (event: MessageEvent<SolverWorkerRequest>) => {
  const message = event.data
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
