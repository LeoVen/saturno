/// <reference lib="webworker" />

// TR-3: the solver runs inside a single dedicated Web Worker, off the main
// thread. E06 wires the quick-generation path (IMPL.md §5.5). E13-T1 adds
// `score` here too (standalone, not just internal to the Refiner). E13-T3
// adds `generateDeep` (Constructor + Refiner, IMPL.md §4.3/§5.1) — this same
// file is what the pool (`deepSearchPool.ts`) spawns N independent instances
// of, each getting its own WASM module instance for free (Workers share no
// memory), rather than a separate worker file.

import init, { generateDeep, generateQuick, score, verify } from './pkg/solver.js'
import type {
  GenerateDeepResult,
  GenerateResult,
  Schedule,
  ScheduleInput,
  ScoreBreakdown,
  Violation,
} from './types'

export type SolverWorkerRequest =
  | { type: 'generateQuick'; requestId: number; input: ScheduleInput }
  | { type: 'verify'; requestId: number; input: ScheduleInput; schedule: Schedule }
  | { type: 'score'; requestId: number; input: ScheduleInput; schedule: Schedule }
  | {
      type: 'generateDeep'
      requestId: number
      input: ScheduleInput
      seed: number
      iterations: number
    }

export type SolverWorkerResponse =
  | { type: 'generateQuick'; requestId: number; result: GenerateResult }
  | { type: 'verify'; requestId: number; violations: Violation[] }
  | { type: 'score'; requestId: number; breakdown: ScoreBreakdown }
  | { type: 'generateDeep'; requestId: number; result: GenerateDeepResult }
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
    } else if (message.type === 'generateDeep') {
      const result = generateDeep(
        message.input,
        message.seed,
        message.iterations,
      ) as GenerateDeepResult
      const response: SolverWorkerResponse = {
        type: 'generateDeep',
        requestId: message.requestId,
        result,
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
