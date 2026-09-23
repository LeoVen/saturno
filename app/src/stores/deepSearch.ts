import { defineStore } from 'pinia'
import { useEntitiesStore } from './entities'
import { buildScheduleInput } from '../solver/generationCoordinator'
import { startDeepSearch } from '../solver/deepSearchCoordinator'
import type { DeepSearchHandle } from '../solver/deepSearchCoordinator'
import type { Candidate, InfeasibilityReport } from '../wasm/types'

/**
 * FR-32/33/34, IMPL.md §7 (E13-T7): the ephemeral Deep Search run store —
 * mirrors `generation.ts`'s own "live-progress/cancel fields... arrive
 * with E13" note. A separate store from `generation` (not extra fields on
 * it) since the two modes' state genuinely differs in shape (progress,
 * a ranked Candidate list, a cancel handle vs. quick mode's single
 * schedule/status) — never persisted (registered in
 * `persistence/persistencePlugin.ts`'s `EPHEMERAL_STORE_IDS`, same as
 * `generation`).
 *
 * The live `DeepSearchHandle` (a `cancel()` function plus a `result`
 * Promise) is deliberately kept as a module-scoped variable, not Pinia
 * state — it isn't data to render or persist, just a live handle to the
 * one in-flight run, the same reasoning `generationCoordinator.ts` keeps
 * its own `worker`/`pending` map outside any store.
 */
let activeHandle: DeepSearchHandle | null = null

export const useDeepSearchStore = defineStore('deepSearch', {
  state: () => ({
    status: 'idle' as 'idle' | 'running' | 'done' | 'infeasible' | 'error',
    elapsedMs: 0,
    bestTotal: null as number | null,
    candidatesFound: 0,
    /** Final merged/deduplicated/ranked list (E13-T5/T6) — populated only once `status` reaches `'done'`. */
    candidates: [] as Candidate[],
    infeasibilityReport: null as InfeasibilityReport | null,
    errorMessage: null as string | null,
  }),
  actions: {
    /** FR-32: `timeBudgetMs` is the user's own choice, e.g. up to several minutes. */
    async start(timeBudgetMs: number): Promise<void> {
      const entities = useEntitiesStore()
      this.status = 'running'
      this.elapsedMs = 0
      this.bestTotal = null
      this.candidatesFound = 0
      this.candidates = []
      this.infeasibilityReport = null
      this.errorMessage = null

      const input = buildScheduleInput(entities)
      const handle = startDeepSearch(input, timeBudgetMs, (progress) => {
        this.elapsedMs = progress.elapsedMs
        this.bestTotal = progress.bestTotal
        this.candidatesFound = progress.candidatesFound
      })
      activeHandle = handle

      try {
        const result = await handle.result
        if (result.status === 'feasible') {
          this.candidates = result.candidates
          this.status = 'done'
        } else {
          this.infeasibilityReport = result.reason
          this.status = 'infeasible'
        }
      } catch (err) {
        this.errorMessage = err instanceof Error ? err.message : String(err)
        this.status = 'error'
      } finally {
        if (activeHandle === handle) activeHandle = null
      }
    },

    /** FR-34: cancel anytime — `start`'s own `await handle.result` still runs to completion (just sooner), so `status` still ends up `'done'` with whatever was found, not stuck at `'running'`. */
    cancel(): void {
      activeHandle?.cancel()
    },
  },
})
