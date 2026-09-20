import type { PiniaPluginContext } from 'pinia'
import { readStoreState, writeStoreState } from './db'

/**
 * IMPL.md §7: the generation-run store is explicitly ephemeral state (an
 * in-progress `generate` run's progress/result) — it must never be
 * hydrated from or written to IndexedDB, unlike the entities/schedule
 * -versions stores this plugin otherwise applies to uniformly.
 */
const EPHEMERAL_STORE_IDS = new Set(['generation'])

/**
 * Hydrate-on-load / write-through persistence (TR-5, IMPL.md §7 skeleton).
 * Every store this plugin is applied to is loaded from IndexedDB on
 * creation and re-written on every mutation. Later epics (E02+) build real
 * entity/schedule-version stores on top of this same pattern.
 */
export function persistencePlugin({ store }: PiniaPluginContext): void {
  if (EPHEMERAL_STORE_IDS.has(store.$id)) return

  void (async () => {
    const saved = await readStoreState(store.$id)
    if (saved !== undefined) {
      // Generic plugin, unaware of any concrete store's state shape —
      // each store is responsible for its own hydration correctness.
      store.$patch(saved as never)
    }
  })()

  store.$subscribe(
    (_mutation, state) => {
      void writeStoreState(store.$id, state)
    },
    { detached: true },
  )
}
