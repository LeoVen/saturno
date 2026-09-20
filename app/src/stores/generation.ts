import { defineStore } from 'pinia'
import { useEntitiesStore } from './entities'
import { buildScheduleInput, generateQuick } from '../solver/generationCoordinator'
import type { Schedule } from '../wasm/types'

/**
 * IMPL.md §7's ephemeral generation-run store: an in-progress/last
 * `generate` run's status and result — never persisted (see
 * persistence/persistencePlugin.ts's `EPHEMERAL_STORE_IDS`). E06 only ever
 * runs quick mode (the Constructor); the live-progress/cancel fields for
 * deep mode (FR-32-34) arrive with E13.
 */
export const useGenerationStore = defineStore('generation', {
  state: () => ({
    status: 'idle' as 'idle' | 'running' | 'feasible' | 'infeasible' | 'error',
    schedule: null as Schedule | null,
    infeasibilityMessage: null as string | null,
    errorMessage: null as string | null,
  }),
  actions: {
    async generate(): Promise<void> {
      const entities = useEntitiesStore()
      this.status = 'running'
      this.schedule = null
      this.infeasibilityMessage = null
      this.errorMessage = null
      try {
        const input = buildScheduleInput(entities)
        const result = await generateQuick(input)
        if (result.status === 'feasible') {
          this.schedule = result.schedule
          this.status = 'feasible'
        } else {
          this.infeasibilityMessage = result.reason.message
          this.status = 'infeasible'
        }
      } catch (err) {
        this.errorMessage = err instanceof Error ? err.message : String(err)
        this.status = 'error'
      }
    },
  },
})
