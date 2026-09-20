import { defineStore } from 'pinia'
import type { Break, Segment, TimeSlot } from '../entities/segment'
import type { Grade } from '../entities/grade'
import type { Class } from '../entities/class'
import type { Subject } from '../entities/subject'
import { isValidRange, sortByStart } from '../entities/time'

/**
 * The entities store (IMPL.md §7): source of truth for school configuration,
 * persisted to IndexedDB via the hydrate-on-load / write-through plugin.
 * E02 adds Segments/Time Slots/Breaks; E03 adds Grades/Classes/Subjects;
 * later epics add Teachers, requirements, etc. to this same store.
 *
 * Grades/Classes/Subjects are kept as flat top-level arrays (referencing
 * their parent by id) rather than nested inside Segment/Grade, since later
 * epics (E04 Teacher availability, E05 requirements) reference a Class or
 * Subject directly by id — unlike Time Slots/Breaks, which are only ever
 * used within their own Segment.
 */
export const useEntitiesStore = defineStore('entities', {
  state: () => ({
    segments: [] as Segment[],
    grades: [] as Grade[],
    classes: [] as Class[],
    subjects: [] as Subject[],
  }),
  getters: {
    segmentById: (state) => {
      return (id: string): Segment | undefined => state.segments.find((s) => s.id === id)
    },
    gradeById: (state) => {
      return (id: string): Grade | undefined => state.grades.find((g) => g.id === id)
    },
    classById: (state) => {
      return (id: string): Class | undefined => state.classes.find((c) => c.id === id)
    },
    subjectById: (state) => {
      return (id: string): Subject | undefined => state.subjects.find((s) => s.id === id)
    },
    gradesBySegment: (state) => {
      return (segmentId: string): Grade[] => state.grades.filter((g) => g.segmentId === segmentId)
    },
    classesByGrade: (state) => {
      return (gradeId: string): Class[] => state.classes.filter((c) => c.gradeId === gradeId)
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
      // Cascade: a Grade cannot outlive its Segment (FR-6), nor a Class its Grade.
      const orphanedGradeIds = new Set(this.gradesBySegment(id).map((g) => g.id))
      this.grades = this.grades.filter((g) => !orphanedGradeIds.has(g.id))
      this.classes = this.classes.filter((c) => !orphanedGradeIds.has(c.gradeId))
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

    addGrade(segmentId: string, name: string): string | undefined {
      if (!this.segmentById(segmentId)) return undefined
      const grade: Grade = { id: crypto.randomUUID(), segmentId, name }
      this.grades.push(grade)
      return grade.id
    },

    renameGrade(id: string, name: string): void {
      const grade = this.gradeById(id)
      if (grade) grade.name = name
    },

    removeGrade(id: string): void {
      this.grades = this.grades.filter((g) => g.id !== id)
      this.classes = this.classes.filter((c) => c.gradeId !== id)
    },

    addClass(gradeId: string, name: string): string | undefined {
      if (!this.gradeById(gradeId)) return undefined
      const schoolClass: Class = { id: crypto.randomUUID(), gradeId, name }
      this.classes.push(schoolClass)
      return schoolClass.id
    },

    renameClass(id: string, name: string): void {
      const schoolClass = this.classById(id)
      if (schoolClass) schoolClass.name = name
    },

    removeClass(id: string): void {
      this.classes = this.classes.filter((c) => c.id !== id)
    },

    addSubject(name: string): string {
      const subject: Subject = { id: crypto.randomUUID(), name }
      this.subjects.push(subject)
      return subject.id
    },

    renameSubject(id: string, name: string): void {
      const subject = this.subjectById(id)
      if (subject) subject.name = name
    },

    removeSubject(id: string): void {
      this.subjects = this.subjects.filter((s) => s.id !== id)
    },
  },
})
