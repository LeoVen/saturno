import { defineStore } from 'pinia'
import type { Profile } from '../entities/profile'
import { DEFAULT_PROFILE_COLOR } from '../entities/profile'
import { deleteStoreState, readStoreState, writeStoreState } from '../persistence/db'
import { profileScopedKey } from '../persistence/profileScoping'

/**
 * INTERLUDE-2 (D-42): the list of Profiles + which one is active. Persisted
 * like any other store, but *not* through the generic persistencePlugin —
 * profilesPersistence.ts owns its hydration (it has to finish a possible
 * first-load migration before `entities`/`scheduleVersions` can hydrate)
 * and its write-through subscription. `duplicate`/`remove` reach into
 * `persistence/db.ts` directly since they move a whole Profile's saved
 * data (not just this store's own state) between/out of IndexedDB keys.
 */
export const useProfilesStore = defineStore('profiles', {
  state: () => ({
    items: [] as Profile[],
    activeProfileId: '' as string,
  }),
  getters: {
    byId: (state) => {
      return (id: string): Profile | undefined => state.items.find((p) => p.id === id)
    },
    activeProfile(): Profile | undefined {
      return this.byId(this.activeProfileId)
    },
  },
  actions: {
    /** Blank Profile — no data copied in. */
    create(name: string, color: string = DEFAULT_PROFILE_COLOR): string {
      const profile: Profile = {
        id: crypto.randomUUID(),
        name: name.trim() || 'Novo Perfil',
        color,
        createdAt: new Date().toISOString(),
      }
      this.items.push(profile)
      this.activeProfileId = profile.id
      return profile.id
    },

    /**
     * Deep-copies `sourceId`'s saved entities/Schedule Versions under a new
     * Profile id, straight through IndexedDB (both Profiles' data is
     * always fully write-through-persisted, so this is never stale even
     * when `sourceId` is the currently active Profile).
     */
    async duplicate(sourceId: string, name: string, color?: string): Promise<string | undefined> {
      const source = this.byId(sourceId)
      if (!source) return undefined

      const profile: Profile = {
        id: crypto.randomUUID(),
        name: name.trim() || `${source.name} (cópia)`,
        color: color ?? source.color,
        createdAt: new Date().toISOString(),
      }

      const [entitiesState, scheduleVersionsState] = await Promise.all([
        readStoreState(profileScopedKey(sourceId, 'entities')),
        readStoreState(profileScopedKey(sourceId, 'scheduleVersions')),
      ])
      await Promise.all([
        entitiesState !== undefined
          ? writeStoreState(profileScopedKey(profile.id, 'entities'), entitiesState)
          : undefined,
        scheduleVersionsState !== undefined
          ? writeStoreState(profileScopedKey(profile.id, 'scheduleVersions'), scheduleVersionsState)
          : undefined,
      ])

      this.items.push(profile)
      this.activeProfileId = profile.id
      return profile.id
    },

    rename(id: string, name: string): void {
      const profile = this.byId(id)
      if (profile && name.trim()) profile.name = name.trim()
    },

    setColor(id: string, color: string): void {
      const profile = this.byId(id)
      if (profile) profile.color = color
    },

    setActive(id: string): boolean {
      if (!this.byId(id)) return false
      this.activeProfileId = id
      return true
    },

    /** Refuses to remove the last remaining Profile — the app always has at least one. */
    async remove(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
      if (this.items.length <= 1) {
        return { ok: false, error: 'Não é possível excluir o único Perfil existente.' }
      }
      if (!this.byId(id)) {
        return { ok: false, error: 'Perfil não encontrado.' }
      }

      const wasActive = this.activeProfileId === id
      this.items = this.items.filter((p) => p.id !== id)
      if (wasActive) this.activeProfileId = this.items[0]!.id

      await Promise.all([
        deleteStoreState(profileScopedKey(id, 'entities')),
        deleteStoreState(profileScopedKey(id, 'scheduleVersions')),
      ])
      return { ok: true }
    },
  },
})
