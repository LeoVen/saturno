// INTERLUDE-2: `entities`/`scheduleVersions` keep their own Pinia store ids
// (no component-facing change), but their IndexedDB key is namespaced by
// the active Profile instead of being the bare store id — this is the one
// place that namespacing format lives, so it can't drift between the
// persistence orchestration (profilesPersistence.ts) and the `profiles`
// store's own duplicate/remove actions.

export type ProfileScopedStoreId = 'entities' | 'scheduleVersions'

export function profileScopedKey(profileId: string, storeId: ProfileScopedStoreId): string {
  return `${profileId}:${storeId}`
}
