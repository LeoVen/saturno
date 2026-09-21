// The Generation Coordinator (IMPL.md §3): a plain TS module, running on
// the main thread, that owns the single Web Worker E06 uses for quick-mode
// generation (TR-3). The Worker pool for deep mode (IMPL.md §5.2) is E13's
// concern — this coordinator only ever talks to one Worker.

import type { useEntitiesStore } from '../stores/entities'
import type { GenerateResult, Schedule, ScheduleInput, Violation } from '../wasm/types'
import type { SolverWorkerRequest, SolverWorkerResponse } from '../wasm/solver.worker'

let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<
  number,
  { resolve: (response: SolverWorkerResponse) => void; reject: (error: Error) => void }
>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../wasm/solver.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
      const message = event.data
      const entry = pending.get(message.requestId)
      if (!entry) return
      pending.delete(message.requestId)
      entry.resolve(message)
    }
    worker.onerror = (event: ErrorEvent) => {
      for (const entry of pending.values()) entry.reject(new Error(event.message))
      pending.clear()
    }
  }
  return worker
}

function send(request: SolverWorkerRequest): Promise<SolverWorkerResponse> {
  return new Promise((resolve, reject) => {
    pending.set(request.requestId, { resolve, reject })
    getWorker().postMessage(request)
  })
}

/**
 * Structured-clone through JSON before it crosses the Worker boundary — the
 * entities store's arrays are Pinia-reactive Proxies, which `postMessage`
 * cannot reliably clone (same reasoning as `persistence/db.ts`'s
 * write-through).
 */
export function buildScheduleInput(entities: ReturnType<typeof useEntitiesStore>): ScheduleInput {
  return JSON.parse(
    JSON.stringify({
      segments: entities.segments,
      grades: entities.grades,
      classes: entities.classes,
      subjects: entities.subjects,
      teachers: entities.teachers,
      assignments: entities.assignments,
      jointSessions: entities.jointSessions,
    }),
  ) as ScheduleInput
}

export async function generateQuick(input: ScheduleInput): Promise<GenerateResult> {
  const requestId = nextRequestId++
  const response = await send({ type: 'generateQuick', requestId, input })
  if (response.type === 'error') throw new Error(response.message)
  if (response.type !== 'generateQuick') throw new Error('Resposta inesperada do solver.')
  return response.result
}

export async function verifySchedule(
  input: ScheduleInput,
  schedule: Schedule,
): Promise<Violation[]> {
  const requestId = nextRequestId++
  // Same reasoning as `buildScheduleInput`: `schedule` is frequently a
  // Pinia-reactive Proxy (e.g. a Schedule Version's `.schedule`, per E09's
  // live conflict-flag check) — `postMessage` cannot structured-clone that,
  // it throws `DataCloneError` at call time, not just a serialization
  // mismatch.
  const clonedSchedule = JSON.parse(JSON.stringify(schedule)) as Schedule
  const response = await send({ type: 'verify', requestId, input, schedule: clonedSchedule })
  if (response.type === 'error') throw new Error(response.message)
  if (response.type !== 'verify') throw new Error('Resposta inesperada do solver.')
  return response.violations
}
