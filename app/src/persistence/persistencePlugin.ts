import type { PiniaPluginContext } from 'pinia'
import { readStoreState, writeStoreState } from './db'

/**
 * Hydrate-on-load / write-through persistence (TR-5, IMPL.md §7 skeleton).
 * Every store this plugin is applied to is loaded from IndexedDB on
 * creation and re-written on every mutation. Later epics (E02+) build real
 * entity/schedule-version stores on top of this same pattern.
 */
export function persistencePlugin({ store }: PiniaPluginContext): void {
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
