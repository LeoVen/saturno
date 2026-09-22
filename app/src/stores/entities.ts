import { defineStore } from 'pinia'
import type { Break, Segment, TimeSlot } from '../entities/segment'
import type { Grade } from '../entities/grade'
import type { Class } from '../entities/class'
import type { Subject } from '../entities/subject'
import type { Teacher, UnavailabilityRange } from '../entities/teacher'
import type { Weekday } from '../entities/weekday'
import type { Assignment } from '../entities/assignment'
import { MAX_CONSECUTIVE_PERIODS } from '../entities/assignment'
import type { JointSession, Track } from '../entities/jointSession'
import { hourlyPeriods, isValidRange, sortByStart, subtractRange } from '../entities/time'
import type { TimeRangeValue } from '../entities/time'
import { sortByWeekdayThenStart } from '../entities/weekday'
import {
  allWeeklyPeriods,
  findOverloadedClasses,
  findZeroOverlapAssignments,
} from '../entities/validation'
import type { AssignmentAvailabilityCheck, ClassLoad } from '../entities/validation'
import { moveItem, moveItemWithinGroup, type MoveDirection } from '../entities/reorder'

/** One Segment's worth of Teacher Availability grid rows (D-29) — `segmentId`/`segmentName` are `null` for the no-Segment-configured-yet fallback group. */
export interface AvailabilityGridGroup {
  segmentId: string | null
  segmentName: string | null
  periods: TimeRangeValue[]
}

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
    teachers: [] as Teacher[],
    assignments: [] as Assignment[],
    jointSessions: [] as JointSession[],
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
    /**
     * Every Class in natural display order — Segment order, then Grade
     * order within it (both user-reorderable, D-26/moveGrade), then Class
     * order within its Grade — rather than an alphabetical relabeling.
     * This is what every "pick any Class" dropdown across the app should
     * render from, so it reflects the order the user actually arranged.
     */
    orderedClasses(): Class[] {
      return this.segments.flatMap((segment) =>
        this.gradesBySegment(segment.id).flatMap((grade) => this.classesByGrade(grade.id)),
      )
    },
    teacherById: (state) => {
      return (id: string): Teacher | undefined => state.teachers.find((t) => t.id === id)
    },
    /** D-25: Teachers qualified for a Subject — narrows the picker on an Assignment (FR-9). */
    teachersForSubject: (state) => {
      return (subjectId: string): Teacher[] =>
        state.teachers.filter((t) => (t.subjectIds ?? []).includes(subjectId))
    },
    /**
     * D-17: a same-name Teacher is disambiguated with a display-only
     * ordinal ("Guilherme (2)") computed at render time from store array
     * order — never a raw id shown to the user.
     */
    teacherLabel() {
      return (id: string): string => {
        const teacher = this.teacherById(id)
        if (!teacher) return '?'
        const sameName = this.teachers.filter((t) => t.name === teacher.name)
        if (sameName.length <= 1) return teacher.name
        const index = sameName.findIndex((t) => t.id === id)
        return `${teacher.name} (${index + 1})`
      }
    },
    assignmentById: (state) => {
      return (id: string): Assignment | undefined => state.assignments.find((a) => a.id === id)
    },
    assignmentsByClass: (state) => {
      return (classId: string): Assignment[] =>
        state.assignments.filter((a) => a.classId === classId)
    },
    assignmentByClassSubject: (state) => {
      return (classId: string, subjectId: string): Assignment | undefined =>
        state.assignments.find((a) => a.classId === classId && a.subjectId === subjectId)
    },
    /**
     * D-29 (supersedes D-15): the Teacher Availability grid's rows, grouped
     * one block per Segment rather than merged into a single flat,
     * time-sorted list. Two Segments' Time Slots can interleave in real
     * time without being the same period sequence (D-01) — e.g. Segment A's
     * 08:40-09:30 next to Segment B's 08:55-09:45 — so merging them made
     * the grid look like one continuous run of back-to-back periods when
     * it wasn't. A Segment with no Time Slots contributes no group; falls
     * back to a single ungrouped hourly grid when no Segment has any yet.
     */
    availabilityGridGroups(): AvailabilityGridGroup[] {
      const groups: AvailabilityGridGroup[] = this.segments
        .filter((s) => s.timeSlots.length > 0)
        .map((s) => ({
          segmentId: s.id,
          segmentName: s.name,
          periods: s.timeSlots.map((t): TimeRangeValue => ({ start: t.start, end: t.end })),
        }))
      return groups.length > 0
        ? groups
        : [{ segmentId: null, segmentName: null, periods: hourlyPeriods(7, 19) }]
    },
    /** Every Time Slot (across all 5 weekdays) the given Class is schedulable during, via its Grade's Segment. */
    classWeeklyPeriods() {
      return (classId: string) => {
        const schoolClass = this.classById(classId)
        const grade = schoolClass ? this.gradeById(schoolClass.gradeId) : undefined
        const segment = grade ? this.segmentById(grade.segmentId) : undefined
        return allWeeklyPeriods(segment?.timeSlots ?? [])
      }
    },
    /** A Class's Segment, resolved via its Grade — `undefined` if the chain is broken. */
    segmentOfClass() {
      return (classId: string): Segment | undefined => {
        const schoolClass = this.classById(classId)
        const grade = schoolClass ? this.gradeById(schoolClass.gradeId) : undefined
        return grade ? this.segmentById(grade.segmentId) : undefined
      }
    },
    jointSessionById: (state) => {
      return (id: string): JointSession | undefined => state.jointSessions.find((s) => s.id === id)
    },
    /** FR-25: every Joint Session a Class participates in — used both for display and to cascade a Class's removal. */
    jointSessionsForClass: (state) => {
      return (classId: string): JointSession[] =>
        state.jointSessions.filter((s) => s.classIds.includes(classId))
    },
    /** FR-30: a Class's total weekly Joint Session occurrences — counts against its period budget (FR-13) without satisfying any (Class, Subject) requirement. */
    jointSessionLoadForClass() {
      return (classId: string): number =>
        this.jointSessionsForClass(classId).reduce((sum, s) => sum + s.weeklyOccurrences, 0)
    },
    /**
     * Every Class's current weekly load: total Assignment occurrences plus
     * Joint Session occurrences (FR-30) vs. its Segment's available
     * periods — the same figures FR-13's overload check compares,
     * surfaced for every Class (not just overloaded ones) so the
     * Assignments screen can show a sanity-check summary.
     */
    classLoads(): ClassLoad[] {
      return this.classes.map((c) => ({
        classId: c.id,
        requiredWeekly:
          this.assignmentsByClass(c.id).reduce((sum, a) => sum + a.weeklyOccurrences, 0) +
          this.jointSessionLoadForClass(c.id),
        availableWeekly: this.classWeeklyPeriods(c.id).length,
      }))
    },
    /** FR-13: Classes whose total weekly required occurrences exceed their Segment's available periods. */
    overloadedClasses(): ClassLoad[] {
      return findOverloadedClasses(this.classLoads)
    },
    /** FR-13: Assignments whose Teacher has zero overlapping availability with the Class's periods. */
    zeroOverlapAssignments() {
      const checks: AssignmentAvailabilityCheck[] = this.assignments.flatMap((a) =>
        a.teacherIds.map((teacherId) => ({
          assignmentId: a.id,
          teacherId,
          classId: a.classId,
          classPeriods: this.classWeeklyPeriods(a.classId),
          unavailability: this.teacherById(teacherId)?.unavailability ?? [],
        })),
      )
      return findZeroOverlapAssignments(checks)
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
      // Cascade: a Grade cannot outlive its Segment (FR-6), nor a Class its
      // Grade, nor an Assignment its Class.
      const orphanedGradeIds = new Set(this.gradesBySegment(id).map((g) => g.id))
      const orphanedClassIds = new Set(
        this.classes.filter((c) => orphanedGradeIds.has(c.gradeId)).map((c) => c.id),
      )
      this.grades = this.grades.filter((g) => !orphanedGradeIds.has(g.id))
      this.classes = this.classes.filter((c) => !orphanedGradeIds.has(c.gradeId))
      this.assignments = this.assignments.filter((a) => !orphanedClassIds.has(a.classId))
      this.pruneJointSessionClasses(orphanedClassIds)
    },

    /** Segments have no natural sort key (unlike Time Slots/Breaks, D-07) — the user orders them by hand, same as Subjects/Teachers (D-26). */
    moveSegment(id: string, direction: MoveDirection): void {
      this.segments = moveItem(this.segments, id, direction)
    },

    /** One-off bulk reorder to alphabetical-by-name (mirrors `sortSubjectsByName`/`sortTeachersByName`, D-26/D-44) — not a standing invariant: `moveSegment` still freely rearranges the result afterward. */
    sortSegmentsByName(): void {
      this.segments = [...this.segments].sort((a, b) => a.name.localeCompare(b.name))
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
      const orphanedClassIds = new Set(this.classesByGrade(id).map((c) => c.id))
      this.classes = this.classes.filter((c) => c.gradeId !== id)
      this.assignments = this.assignments.filter((a) => !orphanedClassIds.has(a.classId))
      this.pruneJointSessionClasses(orphanedClassIds)
    },

    /**
     * Grades have no natural sort key (like Teachers/Subjects, D-26) — but
     * unlike those, `grades` is one flat array shared across every Segment,
     * so a swap must stay within the same Segment's Grades rather than the
     * flat array's raw neighbor (which could belong to a different Segment
     * entirely).
     */
    moveGrade(id: string, direction: MoveDirection): void {
      this.grades = moveItemWithinGroup(this.grades, id, direction, (g) => g.segmentId)
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
      this.assignments = this.assignments.filter((a) => a.classId !== id)
      this.pruneJointSessionClasses(new Set([id]))
    },

    /** FR-25: a Joint Session outlives a removed Class — it just drops that one Class from `classIds`, same "outlives, loses just the one link" pattern as `removeTeacher`/`removeSubject` on an Assignment. */
    pruneJointSessionClasses(removedClassIds: Set<string>): void {
      for (const session of this.jointSessions) {
        session.classIds = session.classIds.filter((cid) => !removedClassIds.has(cid))
      }
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
      this.assignments = this.assignments.filter((a) => a.subjectId !== id)
      for (const teacher of this.teachers) {
        teacher.subjectIds = (teacher.subjectIds ?? []).filter((sid) => sid !== id)
      }
      // A Track *is* one (Subject, Teacher) pair (FR-27) — unlike an
      // Assignment's teacherIds list, there's no partial link to drop, so
      // the whole Track goes with its Subject.
      for (const session of this.jointSessions) {
        session.tracks = session.tracks.filter((t) => t.subjectId !== id)
      }
    },

    /** Subjects have no natural sort key (unlike Time Slots/Breaks, D-07) — the user orders them by hand. */
    moveSubject(id: string, direction: MoveDirection): void {
      this.subjects = moveItem(this.subjects, id, direction)
    },

    /**
     * One-off bulk reorder to alphabetical-by-name (mirrors
     * `sortTeachersByName`, D-26) — a fast way to get a sensible starting
     * order, not a standing invariant: `moveSubject` still freely
     * rearranges the result afterward.
     */
    sortSubjectsByName(): void {
      this.subjects = [...this.subjects].sort((a, b) => a.name.localeCompare(b.name))
    },

    addTeacher(name: string): string {
      // FR-2: names are intentionally not deduplicated/validated for
      // uniqueness — two Teachers may share a name and are distinct
      // entities, disambiguated by id.
      const teacher: Teacher = { id: crypto.randomUUID(), name, unavailability: [], subjectIds: [] }
      this.teachers.push(teacher)
      return teacher.id
    },

    renameTeacher(id: string, name: string): void {
      const teacher = this.teacherById(id)
      if (teacher) teacher.name = name
    },

    removeTeacher(id: string): void {
      this.teachers = this.teachers.filter((t) => t.id !== id)
      // An Assignment outlives a removed Teacher — it just loses that one
      // link from teacherIds (FR-9), rather than being deleted outright.
      for (const assignment of this.assignments) {
        assignment.teacherIds = assignment.teacherIds.filter((tid) => tid !== id)
      }
      // A Track has exactly one Teacher (FR-27, no substitute pool like
      // Assignment's teacherIds) — removed with its Teacher.
      for (const session of this.jointSessions) {
        session.tracks = session.tracks.filter((t) => t.teacherId !== id)
      }
    },

    /** Teachers have no natural sort key (unlike Time Slots/Breaks, D-07) — the user orders them by hand. */
    moveTeacher(id: string, direction: MoveDirection): void {
      this.teachers = moveItem(this.teachers, id, direction)
    },

    /**
     * One-off bulk reorder to alphabetical-by-name — a fast way to get a
     * sensible starting order, not a standing invariant: `moveTeacher`
     * still freely rearranges the result afterward (D-26).
     */
    sortTeachersByName(): void {
      this.teachers = [...this.teachers].sort((a, b) => a.name.localeCompare(b.name))
    },

    /**
     * D-25: which Subjects a Teacher can teach — narrows the Teacher picker
     * on an Assignment (FR-9), nothing more. `?? []` throughout guards
     * against Teacher records persisted before this field existed.
     */
    addTeacherSubject(teacherId: string, subjectId: string): boolean {
      const teacher = this.teacherById(teacherId)
      if (!teacher || !this.subjectById(subjectId)) return false
      teacher.subjectIds = teacher.subjectIds ?? []
      if (teacher.subjectIds.includes(subjectId)) return false
      teacher.subjectIds.push(subjectId)
      return true
    },

    removeTeacherSubject(teacherId: string, subjectId: string): void {
      const teacher = this.teacherById(teacherId)
      if (!teacher) return
      teacher.subjectIds = (teacher.subjectIds ?? []).filter((id) => id !== subjectId)
    },

    addUnavailability(
      teacherId: string,
      weekday: Weekday,
      start: string,
      end: string,
    ): string | undefined {
      const teacher = this.teacherById(teacherId)
      if (!teacher || !isValidRange(start, end)) return undefined
      const range: UnavailabilityRange = { id: crypto.randomUUID(), weekday, start, end }
      teacher.unavailability = sortByWeekdayThenStart([...teacher.unavailability, range])
      return range.id
    },

    updateUnavailability(
      teacherId: string,
      rangeId: string,
      weekday: Weekday,
      start: string,
      end: string,
    ): boolean {
      const teacher = this.teacherById(teacherId)
      const range = teacher?.unavailability.find((r) => r.id === rangeId)
      if (!teacher || !range || !isValidRange(start, end)) return false
      range.weekday = weekday
      range.start = start
      range.end = end
      teacher.unavailability = sortByWeekdayThenStart(teacher.unavailability)
      return true
    },

    removeUnavailability(teacherId: string, rangeId: string): void {
      const teacher = this.teacherById(teacherId)
      if (!teacher) return
      teacher.unavailability = teacher.unavailability.filter((r) => r.id !== rangeId)
    },

    /**
     * WeekGrid's click-to-toggle for one (weekday, period) cell. Marking
     * available again correctly trims/splits whatever existing range(s)
     * cover the cell — not just a same-shape range added earlier by the
     * grid itself — so it behaves correctly even against ranges entered
     * before this UI existed.
     */
    setAvailability(
      teacherId: string,
      weekday: Weekday,
      start: string,
      end: string,
      unavailable: boolean,
    ): boolean {
      const teacher = this.teacherById(teacherId)
      if (!teacher || !isValidRange(start, end)) return false
      if (unavailable) {
        this.addUnavailability(teacherId, weekday, start, end)
        return true
      }
      const remaining: UnavailabilityRange[] = []
      for (const range of teacher.unavailability) {
        if (range.weekday !== weekday) {
          remaining.push(range)
          continue
        }
        for (const piece of subtractRange(range, { start, end })) {
          remaining.push({ ...piece, id: crypto.randomUUID() })
        }
      }
      teacher.unavailability = sortByWeekdayThenStart(remaining)
      return true
    },

    /** FR-11. Each limit is optional — pass `undefined` to clear it. Replaces all three at once. */
    setTeacherLimits(
      teacherId: string,
      limits: {
        maxPeriodsPerDay?: number
        minConsecutivePeriods?: number
        maxConsecutivePeriods?: number
      },
    ): boolean {
      const teacher = this.teacherById(teacherId)
      if (!teacher) return false
      const { maxPeriodsPerDay, minConsecutivePeriods, maxConsecutivePeriods } = limits
      const isPositiveIntOrUndefined = (v?: number) =>
        v === undefined || (Number.isInteger(v) && v >= 1)
      if (
        !isPositiveIntOrUndefined(maxPeriodsPerDay) ||
        !isPositiveIntOrUndefined(minConsecutivePeriods) ||
        !isPositiveIntOrUndefined(maxConsecutivePeriods)
      ) {
        return false
      }
      if (
        minConsecutivePeriods !== undefined &&
        maxConsecutivePeriods !== undefined &&
        minConsecutivePeriods > maxConsecutivePeriods
      ) {
        return false
      }
      teacher.maxPeriodsPerDay = maxPeriodsPerDay
      teacher.minConsecutivePeriods = minConsecutivePeriods
      teacher.maxConsecutivePeriods = maxConsecutivePeriods
      return true
    },

    /** FR-8/9/10/12. At most one Assignment per (Class, Subject) pair — returns undefined if one already exists. */
    addAssignment(classId: string, subjectId: string): string | undefined {
      if (!this.classById(classId) || !this.subjectById(subjectId)) return undefined
      if (this.assignmentByClassSubject(classId, subjectId)) return undefined
      // D-32: consecutivePeriods:2/allowSameDayRepetition:true are the
      // defaults (not 1/false) — real usage shows double periods with
      // same-day repetition allowed is the common case, not the exception.
      const assignment: Assignment = {
        id: crypto.randomUUID(),
        classId,
        subjectId,
        teacherIds: [],
        weeklyOccurrences: 1,
        consecutivePeriods: 2,
        allowSameDayRepetition: true,
      }
      this.assignments.push(assignment)
      return assignment.id
    },

    removeAssignment(id: string): void {
      this.assignments = this.assignments.filter((a) => a.id !== id)
    },

    /**
     * Copies every Assignment from `sourceClassId` to `targetClassId` — the
     * full config (weekly occurrences, consecutive-periods block, same-day
     * override, Teachers), not just the (Class, Subject) link. A Subject
     * already configured on the target is left untouched (skipped, not
     * overwritten) so an existing target config is never silently
     * clobbered by a copy.
     */
    copyAssignments(
      sourceClassId: string,
      targetClassId: string,
    ): { copied: number; skipped: number } {
      if (sourceClassId === targetClassId) return { copied: 0, skipped: 0 }
      let copied = 0
      let skipped = 0
      for (const source of this.assignmentsByClass(sourceClassId)) {
        if (this.assignmentByClassSubject(targetClassId, source.subjectId)) {
          skipped++
          continue
        }
        const newId = this.addAssignment(targetClassId, source.subjectId)
        const created = newId ? this.assignmentById(newId) : undefined
        if (!created) {
          skipped++
          continue
        }
        created.weeklyOccurrences = source.weeklyOccurrences
        created.consecutivePeriods = source.consecutivePeriods
        created.allowSameDayRepetition = source.allowSameDayRepetition
        created.teacherIds = [...source.teacherIds]
        copied++
      }
      return { copied, skipped }
    },

    setWeeklyOccurrences(id: string, weeklyOccurrences: number): boolean {
      const assignment = this.assignmentById(id)
      if (!assignment || !Number.isInteger(weeklyOccurrences) || weeklyOccurrences < 1) return false
      assignment.weeklyOccurrences = weeklyOccurrences
      return true
    },

    /** FR-10: the allowed-consecutive-periods ceiling — 1 (never), 2 (up to double), or 3 (up to triple); validated against `MAX_CONSECUTIVE_PERIODS`, the absolute bound this can be set to. */
    setConsecutivePeriods(id: string, consecutivePeriods: number): boolean {
      const assignment = this.assignmentById(id)
      if (
        !assignment ||
        !Number.isInteger(consecutivePeriods) ||
        consecutivePeriods < 1 ||
        consecutivePeriods > MAX_CONSECUTIVE_PERIODS
      ) {
        return false
      }
      assignment.consecutivePeriods = consecutivePeriods
      return true
    },

    setAllowSameDayRepetition(id: string, allow: boolean): void {
      const assignment = this.assignmentById(id)
      if (assignment) assignment.allowSameDayRepetition = allow
    },

    addAssignmentTeacher(assignmentId: string, teacherId: string): boolean {
      const assignment = this.assignmentById(assignmentId)
      if (!assignment || !this.teacherById(teacherId)) return false
      if (assignment.teacherIds.includes(teacherId)) return false
      assignment.teacherIds.push(teacherId)
      return true
    },

    removeAssignmentTeacher(assignmentId: string, teacherId: string): void {
      const assignment = this.assignmentById(assignmentId)
      if (!assignment) return
      assignment.teacherIds = assignment.teacherIds.filter((id) => id !== teacherId)
    },

    /** FR-25/28. Starts with no participating Classes/Tracks — the user adds them next. */
    addJointSession(name: string): string {
      const session: JointSession = {
        id: crypto.randomUUID(),
        name,
        classIds: [],
        tracks: [],
        weeklyOccurrences: 1,
      }
      this.jointSessions.push(session)
      return session.id
    },

    renameJointSession(id: string, name: string): void {
      const session = this.jointSessionById(id)
      if (session) session.name = name
    },

    removeJointSession(id: string): void {
      this.jointSessions = this.jointSessions.filter((s) => s.id !== id)
    },

    setJointSessionWeeklyOccurrences(id: string, weeklyOccurrences: number): boolean {
      const session = this.jointSessionById(id)
      if (!session || !Number.isInteger(weeklyOccurrences) || weeklyOccurrences < 1) return false
      session.weeklyOccurrences = weeklyOccurrences
      return true
    },

    /**
     * FR-25: every participating Class must belong to the same Segment —
     * a Joint Session's Time Slots only mean one real time for every
     * Class when they share a Segment's structure (FR-5). Rejects a Class
     * from a different Segment than the session's existing participants,
     * or one already in the session.
     */
    addJointSessionClass(sessionId: string, classId: string): boolean {
      const session = this.jointSessionById(sessionId)
      const schoolClass = this.classById(classId)
      if (!session || !schoolClass) return false
      if (session.classIds.includes(classId)) return false
      const newSegment = this.segmentOfClass(classId)
      if (!newSegment) return false
      const existingSegmentIds = new Set(
        session.classIds
          .map((cid) => this.segmentOfClass(cid)?.id)
          .filter((sid): sid is string => sid !== undefined),
      )
      if (existingSegmentIds.size > 0 && !existingSegmentIds.has(newSegment.id)) return false
      session.classIds.push(classId)
      return true
    },

    removeJointSessionClass(sessionId: string, classId: string): void {
      const session = this.jointSessionById(sessionId)
      if (!session) return
      session.classIds = session.classIds.filter((cid) => cid !== classId)
    },

    /** FR-27. Rejects a Teacher already teaching another Track of the same session — every Track runs at the exact same slot(s), so one Teacher can never staff two at once. */
    addTrack(sessionId: string, subjectId: string, teacherId: string): string | undefined {
      const session = this.jointSessionById(sessionId)
      if (!session || !this.subjectById(subjectId) || !this.teacherById(teacherId)) {
        return undefined
      }
      if (session.tracks.some((t) => t.teacherId === teacherId)) return undefined
      const track: Track = { id: crypto.randomUUID(), subjectId, teacherId }
      session.tracks.push(track)
      return track.id
    },

    removeTrack(sessionId: string, trackId: string): void {
      const session = this.jointSessionById(sessionId)
      if (!session) return
      session.tracks = session.tracks.filter((t) => t.id !== trackId)
    },

    setTrackSubject(sessionId: string, trackId: string, subjectId: string): boolean {
      const session = this.jointSessionById(sessionId)
      const track = session?.tracks.find((t) => t.id === trackId)
      if (!track || !this.subjectById(subjectId)) return false
      track.subjectId = subjectId
      return true
    },

    setTrackTeacher(sessionId: string, trackId: string, teacherId: string): boolean {
      const session = this.jointSessionById(sessionId)
      const track = session?.tracks.find((t) => t.id === trackId)
      if (!session || !track || !this.teacherById(teacherId)) return false
      if (session.tracks.some((t) => t.id !== trackId && t.teacherId === teacherId)) return false
      track.teacherId = teacherId
      return true
    },
  },
})
