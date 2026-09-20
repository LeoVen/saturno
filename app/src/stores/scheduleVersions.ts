import { defineStore } from 'pinia'
import type { ScheduleVersion } from '../entities/scheduleVersion'
import type { Schedule } from '../wasm/types'

/**
 * TR-5, IMPL.md §7: the schedule-versions store — persisted (via the same
 * hydrate-on-load / write-through plugin as the entities store), but kept
 * as its own store rather than folded into entities, since it holds
 * user-committed schedules rather than school configuration.
 */
export const useScheduleVersionsStore = defineStore('scheduleVersions', {
  state: () => ({
    versions: [] as ScheduleVersion[],
    activeVersionId: '' as string,
  }),
  getters: {
    versionById: (state) => {
      return (id: string): ScheduleVersion | undefined => state.versions.find((v) => v.id === id)
    },
    activeVersion(): ScheduleVersion | undefined {
      return this.versionById(this.activeVersionId)
    },
  },
  actions: {
    /** E07-T2: wired to E06's Generate output — the first way a Schedule Version comes to exist. */
    createFromSchedule(name: string, schedule: Schedule): string {
      const version: ScheduleVersion = {
        id: crypto.randomUUID(),
        name,
        schedule,
        createdAt: new Date().toISOString(),
      }
      this.versions.push(version)
      this.activeVersionId = version.id
      return version.id
    },

    /** FR-24: duplicate an existing version as the starting point for a new one. */
    duplicate(id: string, name: string): string | undefined {
      const source = this.versionById(id)
      if (!source) return undefined
      const version: ScheduleVersion = {
        id: crypto.randomUUID(),
        name,
        // Structured-clone through JSON: the source's `schedule` may be a
        // Pinia-reactive Proxy, and this must be an independent copy, not
        // a shared reference the two versions would otherwise mutate together.
        schedule: JSON.parse(JSON.stringify(source.schedule)) as Schedule,
        createdAt: new Date().toISOString(),
        duplicatedFromId: source.id,
      }
      this.versions.push(version)
      this.activeVersionId = version.id
      return version.id
    },

    rename(id: string, name: string): void {
      const version = this.versionById(id)
      if (version) version.name = name
    },

    remove(id: string): void {
      this.versions = this.versions.filter((v) => v.id !== id)
      if (this.activeVersionId === id) {
        this.activeVersionId = this.versions[0]?.id ?? ''
      }
    },

    /** FR-24: switch the active version. */
    setActive(id: string): boolean {
      if (!this.versionById(id)) return false
      this.activeVersionId = id
      return true
    },
  },
})
