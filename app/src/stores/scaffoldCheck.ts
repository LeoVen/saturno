import { defineStore } from 'pinia'

/**
 * E01 Human Verification #5 only: proves a value survives a reload through
 * the persistence skeleton. Delete once a real store (E02+) demonstrates
 * the same thing for an actual reason.
 */
export const useScaffoldCheckStore = defineStore('scaffoldCheck', {
  state: () => ({
    lastSavedAt: null as string | null,
  }),
  actions: {
    touch() {
      this.lastSavedAt = new Date().toISOString()
    },
  },
})
