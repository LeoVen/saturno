import { defineStore } from 'pinia'
import type { Break, Segment, TimeSlot } from '../entities/segment'
import { isValidRange, sortByStart } from '../entities/time'

/**
 * The entities store (IMPL.md §7): source of truth for school configuration,
 * persisted to IndexedDB via the hydrate-on-load / write-through plugin.
 * E02 adds Segments/Time Slots/Breaks; later epics (E03+) add Grades,
 * Classes, Subjects, Teachers, etc. to this same store.
 */
export const useEntitiesStore = defineStore('entities', {
  state: () => ({
    segments: [] as Segment[],
  }),
  getters: {
    segmentById: (state) => {
      return (id: string): Segment | undefined => state.segments.find((s) => s.id === id)
    },
  },
  actions: {
    addSegment(name: string): string {
      const segment: Segment = { id: crypto.randomUUID(), name, timeSlots: [], breaks: [] }
      this.segments.push(segment)
      return segment.id
    },

    renameSegment(id: string, name: string): void {
      const segment = this.segmentById(id)
      if (segment) segment.name = name
    },

    removeSegment(id: string): void {
      this.segments = this.segments.filter((s) => s.id !== id)
    },

    addTimeSlot(segmentId: string, start: string, end: string): string | undefined {
      const segment = this.segmentById(segmentId)
      if (!segment || !isValidRange(start, end)) return undefined
      const timeSlot: TimeSlot = { id: crypto.randomUUID(), start, end }
      segment.timeSlots = sortByStart([...segment.timeSlots, timeSlot])
      return timeSlot.id
    },

    updateTimeSlot(segmentId: string, timeSlotId: string, start: string, end: string): boolean {
      const segment = this.segmentById(segmentId)
      const timeSlot = segment?.timeSlots.find((t) => t.id === timeSlotId)
      if (!segment || !timeSlot || !isValidRange(start, end)) return false
      timeSlot.start = start
      timeSlot.end = end
      segment.timeSlots = sortByStart(segment.timeSlots)
      return true
    },

    removeTimeSlot(segmentId: string, timeSlotId: string): void {
      const segment = this.segmentById(segmentId)
      if (!segment) return
      segment.timeSlots = segment.timeSlots.filter((t) => t.id !== timeSlotId)
    },

    addBreak(segmentId: string, start: string, end: string): string | undefined {
      const segment = this.segmentById(segmentId)
      if (!segment || !isValidRange(start, end)) return undefined
      const breakPeriod: Break = { id: crypto.randomUUID(), start, end }
      segment.breaks = sortByStart([...segment.breaks, breakPeriod])
      return breakPeriod.id
    },

    updateBreak(segmentId: string, breakId: string, start: string, end: string): boolean {
      const segment = this.segmentById(segmentId)
      const breakPeriod = segment?.breaks.find((b) => b.id === breakId)
      if (!segment || !breakPeriod || !isValidRange(start, end)) return false
      breakPeriod.start = start
      breakPeriod.end = end
      segment.breaks = sortByStart(segment.breaks)
      return true
    },

    removeBreak(segmentId: string, breakId: string): void {
      const segment = this.segmentById(segmentId)
      if (!segment) return
      segment.breaks = segment.breaks.filter((b) => b.id !== breakId)
    },
  },
})
