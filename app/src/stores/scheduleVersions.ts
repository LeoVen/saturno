import { defineStore } from 'pinia'
import type { ScheduleNote, ScheduleVersion } from '../entities/scheduleVersion'
import type { Schedule } from '../wasm/types'
import { movePlacement as movePlacementPure, type SlotRef } from '../entities/manualEdit'

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
    /** FR-19 — always the safe read path: defaults a pre-E09 (or older-file-imported) Schedule Version's missing `notes` to `[]`, the one place that backward-compatibility default lives. */
    notesFor(): (versionId: string) => ScheduleNote[] {
      return (versionId: string): ScheduleNote[] => this.versionById(versionId)?.notes ?? []
    },
    /** FR-19: the one Note (if any) attached to this exact slot. */
    noteForSlot() {
      return (versionId: string, slot: SlotRef): ScheduleNote | undefined =>
        this.notesFor(versionId).find(
          (n) =>
            n.slot?.classId === slot.classId &&
            n.slot.weekday === slot.weekday &&
            n.slot.timeSlotId === slot.timeSlotId,
        )
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

    /** FR-17: move (or, if `to` is occupied, swap) a placement within one Class's grid. Never blocked by a Hard Constraint (FR-18 flags conflicts separately, live) — returns whether anything actually changed. */
    movePlacement(versionId: string, from: SlotRef, to: SlotRef): boolean {
      const version = this.versionById(versionId)
      if (!version) return false
      const result = movePlacementPure(version.schedule, from, to)
      if (!result) return false
      version.schedule = result.schedule
      return result.changed
    },

    /** FR-19: attach a new Note — pass `slot` for a slot-level Note, omit it for a whole-schedule Note. */
    addNote(versionId: string, text: string, slot?: SlotRef): string | undefined {
      const version = this.versionById(versionId)
      if (!version || !text.trim()) return undefined
      const note: ScheduleNote = {
        id: crypto.randomUUID(),
        text: text.trim(),
        createdAt: new Date().toISOString(),
        slot,
      }
      version.notes = [...(version.notes ?? []), note]
      return note.id
    },

    updateNote(versionId: string, noteId: string, text: string): void {
      const note = this.versionById(versionId)?.notes?.find((n) => n.id === noteId)
      if (note && text.trim()) note.text = text.trim()
    },

    removeNote(versionId: string, noteId: string): void {
      const version = this.versionById(versionId)
      if (!version?.notes) return
      version.notes = version.notes.filter((n) => n.id !== noteId)
    },
  },
})
