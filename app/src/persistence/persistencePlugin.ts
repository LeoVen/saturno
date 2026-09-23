import type { PiniaPluginContext } from 'pinia'
import { readStoreState, writeStoreState } from './db'

/**
 * IMPL.md §7: the generation-run stores are explicitly ephemeral state (an
 * in-progress `generate`/Deep Search run's progress/result) — they must
 * never be hydrated from or written to IndexedDB, unlike the entities/
 * schedule-versions stores this plugin otherwise applies to uniformly.
 */
const EPHEMERAL_STORE_IDS = new Set(['generation', 'deepSearch'])

/**
 * INTERLUDE-2 (D-42): these three are persisted, but not through this
 * generic plugin — `profilesPersistence.ts` owns them instead, since
 * `entities`/`scheduleVersions` need a Profile-namespaced IndexedDB key
 * (not their bare store id) and have to re-hydrate whenever the active
 * Profile switches, and `profiles` itself needs its first-load migration
 * finished before any of that can happen.
 */
const PROFILE_MANAGED_STORE_IDS = new Set(['profiles', 'entities', 'scheduleVersions'])

/**
 * Hydrate-on-load / write-through persistence (TR-5, IMPL.md §7 skeleton).
 * Every store this plugin is applied to is loaded from IndexedDB on
 * creation and re-written on every mutation. Later epics (E02+) build real
 * entity/schedule-version stores on top of this same pattern.
 */
export function persistencePlugin({ store }: PiniaPluginContext): void {
  if (EPHEMERAL_STORE_IDS.has(store.$id) || PROFILE_MANAGED_STORE_IDS.has(store.$id)) return

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
