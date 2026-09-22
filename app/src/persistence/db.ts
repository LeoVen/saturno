import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'saturno'
const DB_VERSION = 1

// Every Pinia store's whole state is persisted here, keyed by store id.
// Real entity/schedule-version stores (E02+) will likely outgrow this
// single-object-store shape — this is the E01 skeleton, not the final
// schema (TR-5).
const PINIA_STATE_STORE = 'pinia-state'

let dbPromise: Promise<IDBPDatabase> | null = null

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PINIA_STATE_STORE)) {
          db.createObjectStore(PINIA_STATE_STORE)
        }
      },
    })
  }
  return dbPromise
}

export async function readStoreState(storeId: string): Promise<unknown> {
  const db = await getDb()
  return db.get(PINIA_STATE_STORE, storeId)
}

export async function writeStoreState(storeId: string, state: unknown): Promise<void> {
  const db = await getDb()
  // Structured-clone through JSON to strip anything IndexedDB can't store
  // (e.g. a stray class instance) — fine at this scale (TR-10).
  await db.put(PINIA_STATE_STORE, JSON.parse(JSON.stringify(state)), storeId)
}

/** INTERLUDE-2: removes one profile-scoped key's saved state entirely — used when a Profile is deleted, so its data doesn't linger orphaned in IndexedDB. A no-op if the key was never written. */
export async function deleteStoreState(storeId: string): Promise<void> {
  const db = await getDb()
  await db.delete(PINIA_STATE_STORE, storeId)
}
