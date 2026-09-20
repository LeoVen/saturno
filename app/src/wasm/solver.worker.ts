/// <reference lib="webworker" />

// E01-T2 toolchain spike only: proves Rust -> WASM -> Worker works
// end-to-end. Delete/replace once E06 wires the real `verify`/`generate`
// worker (IMPL.md §3/§5.2).

import init, { ping } from './pkg/solver.js'

export type SolverWorkerRequest = { type: 'ping' }
export type SolverWorkerResponse = { type: 'pong'; message: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

let ready: Promise<void> | null = null
function ensureReady(): Promise<void> {
  if (!ready) {
    ready = init().then(() => undefined)
  }
  return ready
}

ctx.onmessage = async (event: MessageEvent<SolverWorkerRequest>) => {
  await ensureReady()
  if (event.data.type === 'ping') {
    const response: SolverWorkerResponse = { type: 'pong', message: ping() }
    ctx.postMessage(response)
  }
}
