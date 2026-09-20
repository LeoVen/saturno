import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEntitiesStore } from './entities'

describe('entities store — Segments', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no segments', () => {
    const store = useEntitiesStore()
    expect(store.segments).toEqual([])
  })

  it('adds, renames, and removes a Segment', () => {
    const store = useEntitiesStore()
    const id = store.addSegment('Ensino Fundamental')
    expect(store.segments).toHaveLength(1)
    expect(store.segmentById(id)?.name).toBe('Ensino Fundamental')

    store.renameSegment(id, 'EF')
    expect(store.segmentById(id)?.name).toBe('EF')

    store.removeSegment(id)
    expect(store.segments).toHaveLength(0)
  })
})

describe('entities store — Time Slots', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds Time Slots and keeps them ordered by start time', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('Ensino Médio')

    store.addTimeSlot(segmentId, '09:30', '10:20')
    store.addTimeSlot(segmentId, '08:00', '08:50')

    const slots = store.segmentById(segmentId)?.timeSlots ?? []
    expect(slots.map((s) => s.start)).toEqual(['08:00', '09:30'])
  })

  it('rejects an invalid range and adds nothing', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EM')

    const result = store.addTimeSlot(segmentId, '10:00', '09:00')

    expect(result).toBeUndefined()
    expect(store.segmentById(segmentId)?.timeSlots).toHaveLength(0)
  })

  it('updates a Time Slot and re-sorts', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EM')
    const a = store.addTimeSlot(segmentId, '08:00', '08:50')
    store.addTimeSlot(segmentId, '09:00', '09:50')

    const updated = store.updateTimeSlot(segmentId, a as string, '10:00', '10:50')

    expect(updated).toBe(true)
    const slots = store.segmentById(segmentId)?.timeSlots ?? []
    expect(slots.map((s) => s.start)).toEqual(['09:00', '10:00'])
  })

  it('removes a Time Slot', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EM')
    const id = store.addTimeSlot(segmentId, '08:00', '08:50') as string

    store.removeTimeSlot(segmentId, id)

    expect(store.segmentById(segmentId)?.timeSlots).toHaveLength(0)
  })
})

describe('entities store — Breaks', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('supports multiple Breaks per Segment, ordered by start time', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('Ensino Médio')

    store.addBreak(segmentId, '10:35', '10:50')
    store.addBreak(segmentId, '08:40', '08:55')

    const breaks = store.segmentById(segmentId)?.breaks ?? []
    expect(breaks.map((b) => b.start)).toEqual(['08:40', '10:35'])
  })

  it('rejects an invalid range and adds nothing', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EF')

    const result = store.addBreak(segmentId, '09:30', '09:30')

    expect(result).toBeUndefined()
    expect(store.segmentById(segmentId)?.breaks).toHaveLength(0)
  })

  it('updates and removes a Break', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EF')
    const id = store.addBreak(segmentId, '09:30', '10:00') as string

    expect(store.updateBreak(segmentId, id, '09:40', '10:10')).toBe(true)
    expect(store.segmentById(segmentId)?.breaks[0]).toMatchObject({ start: '09:40', end: '10:10' })

    store.removeBreak(segmentId, id)
    expect(store.segmentById(segmentId)?.breaks).toHaveLength(0)
  })
})

describe('entities store — Grades', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds a Grade under its Segment and renames it', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('Ensino Fundamental')

    const gradeId = store.addGrade(segmentId, '7º Ano') as string

    expect(store.gradesBySegment(segmentId)).toHaveLength(1)
    expect(store.gradeById(gradeId)?.name).toBe('7º Ano')

    store.renameGrade(gradeId, '7º Ano (EF2)')
    expect(store.gradeById(gradeId)?.name).toBe('7º Ano (EF2)')
  })

  it('rejects a Grade under a nonexistent Segment', () => {
    const store = useEntitiesStore()
    expect(store.addGrade('does-not-exist', '7º Ano')).toBeUndefined()
    expect(store.grades).toHaveLength(0)
  })

  it('removing a Grade cascades to its Classes', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EF')
    const gradeId = store.addGrade(segmentId, '7º Ano') as string
    store.addClass(gradeId, '7º Ano A')
    store.addClass(gradeId, '7º Ano B')

    store.removeGrade(gradeId)

    expect(store.grades).toHaveLength(0)
    expect(store.classes).toHaveLength(0)
  })

  it('removing a Segment cascades to its Grades and their Classes', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EF')
    const gradeId = store.addGrade(segmentId, '7º Ano') as string
    store.addClass(gradeId, '7º Ano A')

    store.removeSegment(segmentId)

    expect(store.grades).toHaveLength(0)
    expect(store.classes).toHaveLength(0)
  })

  it('reorders Grades within their own Segment only, ignoring other Segments interleaved in storage', () => {
    const store = useEntitiesStore()
    const segA = store.addSegment('EF')
    const segB = store.addSegment('EM')
    // Interleaved on purpose, as real usage would create them.
    const a1 = store.addGrade(segA, 'A1') as string
    const b1 = store.addGrade(segB, 'B1') as string
    const a2 = store.addGrade(segA, 'A2') as string

    store.moveGrade(a2, 'up')
    expect(store.gradesBySegment(segA).map((g) => g.id)).toEqual([a2, a1])
    // segB's own Grade order is untouched.
    expect(store.gradesBySegment(segB).map((g) => g.id)).toEqual([b1])

    // No-op: a2 is now first within segA, even though b1 sits before it
    // in the flat underlying array.
    store.moveGrade(a2, 'up')
    expect(store.gradesBySegment(segA).map((g) => g.id)).toEqual([a2, a1])
  })
})

describe('entities store — Classes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds Classes under a Grade and renames/removes one', () => {
    const store = useEntitiesStore()
    const segmentId = store.addSegment('EF')
    const gradeId = store.addGrade(segmentId, '7º Ano') as string

    const classAId = store.addClass(gradeId, '7º Ano A') as string
    store.addClass(gradeId, '7º Ano B')

    expect(store.classesByGrade(gradeId).map((c) => c.name)).toEqual(['7º Ano A', '7º Ano B'])

    store.renameClass(classAId, '7º Ano A (renomeada)')
    expect(store.classById(classAId)?.name).toBe('7º Ano A (renomeada)')

    store.removeClass(classAId)
    expect(store.classesByGrade(gradeId)).toHaveLength(1)
  })

  it('rejects a Class under a nonexistent Grade', () => {
    const store = useEntitiesStore()
    expect(store.addClass('does-not-exist', '7º Ano A')).toBeUndefined()
    expect(store.classes).toHaveLength(0)
  })

  it('orderedClasses reflects Segment/Grade/Class order, not alphabetical order', () => {
    const store = useEntitiesStore()
    // "EM" added after "EF" but named to sort before it alphabetically —
    // orderedClasses must still follow Segment creation order.
    const segEF = store.addSegment('EF')
    const segEM = store.addSegment('EM')
    const gradeEF = store.addGrade(segEF, '9º Ano') as string
    const gradeEM = store.addGrade(segEM, '1ª Série') as string
    const classEF = store.addClass(gradeEF, 'Turma Z') as string
    const classEM = store.addClass(gradeEM, 'Turma A') as string

    expect(store.orderedClasses.map((c) => c.id)).toEqual([classEF, classEM])

    // Reordering the Grades changes the derived Class order too.
    store.moveGrade(gradeEM, 'up') // no-op: different Segment, no sibling to swap with
    expect(store.orderedClasses.map((c) => c.id)).toEqual([classEF, classEM])
  })
})

describe('entities store — Subjects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds, renames, and removes a Subject in the global catalog', () => {
    const store = useEntitiesStore()
    const id = store.addSubject('História')

    expect(store.subjects).toHaveLength(1)
    expect(store.subjectById(id)?.name).toBe('História')

    store.renameSubject(id, 'História Geral')
    expect(store.subjectById(id)?.name).toBe('História Geral')

    store.removeSubject(id)
    expect(store.subjects).toHaveLength(0)
  })

  it('reorders Subjects (no natural sort key, unlike Time Slots/Breaks)', () => {
    const store = useEntitiesStore()
    const a = store.addSubject('A')
    const b = store.addSubject('B')
    const c = store.addSubject('C')

    store.moveSubject(b, 'up')
    expect(store.subjects.map((s) => s.id)).toEqual([b, a, c])

    store.moveSubject(b, 'down')
    store.moveSubject(b, 'down')
    expect(store.subjects.map((s) => s.id)).toEqual([a, c, b])

    // No-ops at the boundaries.
    store.moveSubject(a, 'up')
    store.moveSubject(b, 'down')
    expect(store.subjects.map((s) => s.id)).toEqual([a, c, b])
  })
})

describe('entities store — Teachers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('allows two Teachers with the same name as distinct entities', () => {
    const store = useEntitiesStore()
    const a = store.addTeacher('Guilherme')
    const b = store.addTeacher('Guilherme')

    expect(a).not.toBe(b)
    expect(store.teachers).toHaveLength(2)
    expect(store.teacherById(a)?.name).toBe('Guilherme')
    expect(store.teacherById(b)?.name).toBe('Guilherme')
  })

  it('renames and removes a Teacher', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')

    store.renameTeacher(id, 'Guilherme Silva')
    expect(store.teacherById(id)?.name).toBe('Guilherme Silva')

    store.removeTeacher(id)
    expect(store.teachers).toHaveLength(0)
  })

  it('starts with no unavailability (fully available by default)', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')
    expect(store.teacherById(id)?.unavailability).toEqual([])
  })

  it('starts with no Subject qualifications (D-25)', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')
    expect(store.teacherById(id)?.subjectIds).toEqual([])
  })

  it('reorders Teachers (no natural sort key, unlike Time Slots/Breaks)', () => {
    const store = useEntitiesStore()
    const a = store.addTeacher('Ana')
    const b = store.addTeacher('Bruno')
    const c = store.addTeacher('Carla')

    store.moveTeacher(c, 'up')
    expect(store.teachers.map((t) => t.id)).toEqual([a, c, b])

    // No-op moving the first item further up.
    store.moveTeacher(a, 'up')
    expect(store.teachers.map((t) => t.id)).toEqual([a, c, b])
  })
})

describe('entities store — Teacher Subjects (D-25)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds and removes a Subject qualification', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    const subjectId = store.addSubject('Matemática')

    expect(store.addTeacherSubject(teacherId, subjectId)).toBe(true)
    expect(store.teacherById(teacherId)?.subjectIds).toEqual([subjectId])
    expect(store.teachersForSubject(subjectId).map((t) => t.id)).toEqual([teacherId])

    store.removeTeacherSubject(teacherId, subjectId)
    expect(store.teacherById(teacherId)?.subjectIds).toEqual([])
    expect(store.teachersForSubject(subjectId)).toEqual([])
  })

  it('refuses to add a duplicate or an unknown Teacher/Subject', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    const subjectId = store.addSubject('Matemática')

    store.addTeacherSubject(teacherId, subjectId)
    expect(store.addTeacherSubject(teacherId, subjectId)).toBe(false)
    expect(store.addTeacherSubject('missing', subjectId)).toBe(false)
    expect(store.addTeacherSubject(teacherId, 'missing')).toBe(false)
    expect(store.teacherById(teacherId)?.subjectIds).toEqual([subjectId])
  })

  it('removing a Subject cleans up every Teacher that was qualified for it', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    const subjectId = store.addSubject('Matemática')
    store.addTeacherSubject(teacherId, subjectId)

    store.removeSubject(subjectId)
    expect(store.teacherById(teacherId)?.subjectIds).toEqual([])
  })
})

describe('entities store — teacherLabel (D-17)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is just the name when it is unique', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')
    expect(store.teacherLabel(id)).toBe('Guilherme')
  })

  it('appends a stable ordinal, never a raw id, when names collide', () => {
    const store = useEntitiesStore()
    const a = store.addTeacher('Guilherme')
    const b = store.addTeacher('Guilherme')

    expect(store.teacherLabel(a)).toBe('Guilherme (1)')
    expect(store.teacherLabel(b)).toBe('Guilherme (2)')
  })

  it('is unaffected by an unrelated Teacher with a different name', () => {
    const store = useEntitiesStore()
    const a = store.addTeacher('Guilherme')
    store.addTeacher('Fernanda')
    expect(store.teacherLabel(a)).toBe('Guilherme')
  })
})

describe('entities store — Teacher Availability', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds an Unavailability range for a partial, non-whole-day pattern', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')

    const id = store.addUnavailability(teacherId, 'tue', '13:00', '18:00')

    expect(id).toBeDefined()
    expect(store.teacherById(teacherId)?.unavailability).toEqual([
      { id, weekday: 'tue', start: '13:00', end: '18:00' },
    ])
  })

  it('orders ranges by weekday then start time', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')

    store.addUnavailability(teacherId, 'wed', '08:00', '09:00')
    store.addUnavailability(teacherId, 'mon', '14:00', '15:00')
    store.addUnavailability(teacherId, 'mon', '08:00', '09:00')

    const ranges = store.teacherById(teacherId)?.unavailability ?? []
    expect(ranges.map((r) => [r.weekday, r.start])).toEqual([
      ['mon', '08:00'],
      ['mon', '14:00'],
      ['wed', '08:00'],
    ])
  })

  it('rejects an invalid range and adds nothing', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')

    const result = store.addUnavailability(teacherId, 'tue', '18:00', '13:00')

    expect(result).toBeUndefined()
    expect(store.teacherById(teacherId)?.unavailability).toHaveLength(0)
  })

  it('rejects a range for a nonexistent Teacher', () => {
    const store = useEntitiesStore()
    expect(store.addUnavailability('does-not-exist', 'tue', '13:00', '18:00')).toBeUndefined()
  })

  it('updates and removes an Unavailability range', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    const id = store.addUnavailability(teacherId, 'tue', '13:00', '18:00') as string

    expect(store.updateUnavailability(teacherId, id, 'wed', '14:00', '17:00')).toBe(true)
    expect(store.teacherById(teacherId)?.unavailability[0]).toMatchObject({
      weekday: 'wed',
      start: '14:00',
      end: '17:00',
    })

    store.removeUnavailability(teacherId, id)
    expect(store.teacherById(teacherId)?.unavailability).toHaveLength(0)
  })
})

describe('entities store — setAvailability (WeekGrid click-to-toggle)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marking a cell unavailable adds a range', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')

    expect(store.setAvailability(teacherId, 'tue', '08:00', '08:50', true)).toBe(true)

    expect(store.teacherById(teacherId)?.unavailability).toMatchObject([
      { weekday: 'tue', start: '08:00', end: '08:50' },
    ])
  })

  it('marking a cell available removes an exactly-matching range', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    store.setAvailability(teacherId, 'tue', '08:00', '08:50', true)

    store.setAvailability(teacherId, 'tue', '08:00', '08:50', false)

    expect(store.teacherById(teacherId)?.unavailability).toEqual([])
  })

  it('marking a cell available trims a broader pre-existing range instead of ignoring it', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    // A range spanning three grid periods, entered before the grid UI existed.
    store.addUnavailability(teacherId, 'tue', '08:00', '10:30')

    // Clear only the middle period.
    store.setAvailability(teacherId, 'tue', '08:50', '09:40', false)

    const ranges = store.teacherById(teacherId)?.unavailability ?? []
    expect(ranges.map((r) => [r.weekday, r.start, r.end])).toEqual([
      ['tue', '08:00', '08:50'],
      ['tue', '09:40', '10:30'],
    ])
  })

  it('does not touch other weekdays', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    store.addUnavailability(teacherId, 'mon', '08:00', '08:50')

    store.setAvailability(teacherId, 'tue', '08:00', '08:50', false)

    expect(store.teacherById(teacherId)?.unavailability).toMatchObject([
      { weekday: 'mon', start: '08:00', end: '08:50' },
    ])
  })

  it('rejects an invalid range or a nonexistent Teacher', () => {
    const store = useEntitiesStore()
    const teacherId = store.addTeacher('Guilherme')
    expect(store.setAvailability(teacherId, 'tue', '09:00', '08:00', true)).toBe(false)
    expect(store.setAvailability('does-not-exist', 'tue', '08:00', '08:50', true)).toBe(false)
  })
})

describe('entities store — availabilityGridPeriods (D-15)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('falls back to an hourly grid when no Segment is configured', () => {
    const store = useEntitiesStore()
    expect(store.availabilityGridPeriods[0]).toEqual({ start: '07:00', end: '08:00' })
    expect(store.availabilityGridPeriods).toHaveLength(12)
  })

  it('merges and de-duplicates Time Slots across every Segment', () => {
    const store = useEntitiesStore()
    const efId = store.addSegment('EF')
    store.addTimeSlot(efId, '08:00', '08:50')
    store.addTimeSlot(efId, '08:50', '09:40')
    const emId = store.addSegment('EM')
    store.addTimeSlot(emId, '08:00', '08:50') // exact duplicate across Segments
    store.addTimeSlot(emId, '07:00', '07:50')

    expect(store.availabilityGridPeriods.map(({ start, end }) => ({ start, end }))).toEqual([
      { start: '07:00', end: '07:50' },
      { start: '08:00', end: '08:50' },
      { start: '08:50', end: '09:40' },
    ])
  })
})

describe('entities store — Teacher limits (FR-11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sets and clears optional per-Teacher limits', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')

    expect(
      store.setTeacherLimits(id, {
        maxPeriodsPerDay: 6,
        minConsecutivePeriods: 2,
        maxConsecutivePeriods: 4,
      }),
    ).toBe(true)
    expect(store.teacherById(id)).toMatchObject({
      maxPeriodsPerDay: 6,
      minConsecutivePeriods: 2,
      maxConsecutivePeriods: 4,
    })

    expect(store.setTeacherLimits(id, {})).toBe(true)
    expect(store.teacherById(id)?.maxPeriodsPerDay).toBeUndefined()
  })

  it('rejects a non-positive-integer limit', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')
    expect(store.setTeacherLimits(id, { maxPeriodsPerDay: 0 })).toBe(false)
    expect(store.setTeacherLimits(id, { maxPeriodsPerDay: 1.5 })).toBe(false)
  })

  it('rejects min consecutive periods greater than max', () => {
    const store = useEntitiesStore()
    const id = store.addTeacher('Guilherme')
    expect(store.setTeacherLimits(id, { minConsecutivePeriods: 5, maxConsecutivePeriods: 2 })).toBe(
      false,
    )
  })
})

function setUpSegmentWithClass(store: ReturnType<typeof useEntitiesStore>, periods: number) {
  const segmentId = store.addSegment('Ensino Fundamental')
  for (let i = 0; i < periods; i++) {
    const h = String(8 + i).padStart(2, '0')
    const h2 = String(9 + i).padStart(2, '0')
    store.addTimeSlot(segmentId, `${h}:00`, `${h2}:00`)
  }
  const gradeId = store.addGrade(segmentId, '7º Ano') as string
  const classId = store.addClass(gradeId, '7º Ano A') as string
  return { segmentId, gradeId, classId }
}

describe('entities store — Assignments (FR-8/9/10/12)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates an Assignment with sane defaults and enforces one per (Class, Subject)', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('História')

    const id = store.addAssignment(classId, subjectId) as string
    expect(store.assignmentById(id)).toMatchObject({
      classId,
      subjectId,
      teacherIds: [],
      weeklyOccurrences: 1,
      consecutivePeriods: 1,
      allowSameDayRepetition: false,
    })

    expect(store.addAssignment(classId, subjectId)).toBeUndefined()
    expect(store.assignmentsByClass(classId)).toHaveLength(1)
  })

  it('rejects an Assignment for a nonexistent Class or Subject', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('História')

    expect(store.addAssignment('nope', subjectId)).toBeUndefined()
    expect(store.addAssignment(classId, 'nope')).toBeUndefined()
  })

  it('sets weekly occurrences, rejecting non-positive-integer counts', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('História')
    const id = store.addAssignment(classId, subjectId) as string

    expect(store.setWeeklyOccurrences(id, 4)).toBe(true)
    expect(store.assignmentById(id)?.weeklyOccurrences).toBe(4)
    expect(store.setWeeklyOccurrences(id, 0)).toBe(false)
  })

  it('enforces the hard 3-period consecutive ceiling (FR-10)', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Educação Física')
    const id = store.addAssignment(classId, subjectId) as string

    expect(store.setConsecutivePeriods(id, 3)).toBe(true)
    expect(store.setConsecutivePeriods(id, 4)).toBe(false)
    expect(store.assignmentById(id)?.consecutivePeriods).toBe(3)
  })

  it('toggles the same-day repetition override (FR-12)', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Matemática')
    const id = store.addAssignment(classId, subjectId) as string

    expect(store.assignmentById(id)?.allowSameDayRepetition).toBe(false)
    store.setAllowSameDayRepetition(id, true)
    expect(store.assignmentById(id)?.allowSameDayRepetition).toBe(true)
  })

  it('adds and removes Teachers from an Assignment, rejecting duplicates and unknown Teachers', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Matemática')
    const assignmentId = store.addAssignment(classId, subjectId) as string
    const teacherId = store.addTeacher('Guilherme')

    expect(store.addAssignmentTeacher(assignmentId, teacherId)).toBe(true)
    expect(store.addAssignmentTeacher(assignmentId, teacherId)).toBe(false)
    expect(store.addAssignmentTeacher(assignmentId, 'nope')).toBe(false)
    expect(store.assignmentById(assignmentId)?.teacherIds).toEqual([teacherId])

    store.removeAssignmentTeacher(assignmentId, teacherId)
    expect(store.assignmentById(assignmentId)?.teacherIds).toEqual([])
  })

  it('cascades: removing a Class, Subject, Segment, or Grade removes its Assignments', () => {
    const store = useEntitiesStore()
    const { classId: c1 } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Matemática')
    store.addAssignment(c1, subjectId)
    expect(store.assignments).toHaveLength(1)
    store.removeClass(c1)
    expect(store.assignments).toHaveLength(0)

    const { classId: c2 } = setUpSegmentWithClass(store, 1)
    store.addAssignment(c2, subjectId)
    store.removeSubject(subjectId)
    expect(store.assignments).toHaveLength(0)

    const subjectId2 = store.addSubject('Geografia')
    const { segmentId: seg3, classId: c3 } = setUpSegmentWithClass(store, 1)
    store.addAssignment(c3, subjectId2)
    store.removeSegment(seg3)
    expect(store.assignments).toHaveLength(0)

    const subjectId3 = store.addSubject('Ciências')
    const { gradeId: g4, classId: c4 } = setUpSegmentWithClass(store, 1)
    store.addAssignment(c4, subjectId3)
    store.removeGrade(g4)
    expect(store.assignments).toHaveLength(0)
  })

  it('removing a Teacher unlinks it from Assignments without deleting them', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Matemática')
    const assignmentId = store.addAssignment(classId, subjectId) as string
    const teacherId = store.addTeacher('Guilherme')
    store.addAssignmentTeacher(assignmentId, teacherId)

    store.removeTeacher(teacherId)

    expect(store.assignments).toHaveLength(1)
    expect(store.assignmentById(assignmentId)?.teacherIds).toEqual([])
  })

  it('copies every field of a source Class Assignment onto another Class', () => {
    const store = useEntitiesStore()
    const { gradeId, classId: source } = setUpSegmentWithClass(store, 2)
    const target = store.addClass(gradeId, '7º Ano B') as string
    const subjectId = store.addSubject('Matemática')
    const teacherId = store.addTeacher('Guilherme')
    const sourceAssignmentId = store.addAssignment(source, subjectId) as string
    store.setWeeklyOccurrences(sourceAssignmentId, 4)
    store.setConsecutivePeriods(sourceAssignmentId, 2)
    store.setAllowSameDayRepetition(sourceAssignmentId, true)
    store.addAssignmentTeacher(sourceAssignmentId, teacherId)

    const result = store.copyAssignments(source, target)
    expect(result).toEqual({ copied: 1, skipped: 0 })

    const copied = store.assignmentByClassSubject(target, subjectId)
    expect(copied).toMatchObject({
      weeklyOccurrences: 4,
      consecutivePeriods: 2,
      allowSameDayRepetition: true,
      teacherIds: [teacherId],
    })
    // Independent copy: editing the source afterward must not affect the target.
    store.setWeeklyOccurrences(sourceAssignmentId, 1)
    expect(store.assignmentByClassSubject(target, subjectId)?.weeklyOccurrences).toBe(4)
  })

  it('skips a Subject already configured on the target Class rather than overwriting it', () => {
    const store = useEntitiesStore()
    const { gradeId, classId: source } = setUpSegmentWithClass(store, 2)
    const target = store.addClass(gradeId, '7º Ano B') as string
    const subjectId = store.addSubject('Matemática')
    store.addAssignment(source, subjectId)
    const targetAssignmentId = store.addAssignment(target, subjectId) as string
    store.setWeeklyOccurrences(targetAssignmentId, 9)

    const result = store.copyAssignments(source, target)
    expect(result).toEqual({ copied: 0, skipped: 1 })
    expect(store.assignmentByClassSubject(target, subjectId)?.weeklyOccurrences).toBe(9)
  })

  it('is a no-op copying a Class onto itself', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Matemática')
    store.addAssignment(classId, subjectId)

    expect(store.copyAssignments(classId, classId)).toEqual({ copied: 0, skipped: 0 })
    expect(store.assignments).toHaveLength(1)
  })
})

describe('entities store — FR-13 validation getters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('flags an overloaded Class', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 2) // 2 slots/day * 5 days = 10 available/week
    const subjectId = store.addSubject('Matemática')
    const id = store.addAssignment(classId, subjectId) as string
    store.setWeeklyOccurrences(id, 12)

    expect(store.overloadedClasses).toEqual([{ classId, requiredWeekly: 12, availableWeekly: 10 }])
  })

  it('does not flag a Class within capacity', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 2)
    const subjectId = store.addSubject('Matemática')
    const id = store.addAssignment(classId, subjectId) as string
    store.setWeeklyOccurrences(id, 5)

    expect(store.overloadedClasses).toEqual([])
  })

  it('classLoads reports every Class, not just overloaded ones', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 2)
    const subjectId = store.addSubject('Matemática')
    const id = store.addAssignment(classId, subjectId) as string
    store.setWeeklyOccurrences(id, 5)

    expect(store.classLoads).toEqual([{ classId, requiredWeekly: 5, availableWeekly: 10 }])
  })

  it('flags an Assignment whose Teacher has zero overlapping availability', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1) // single 08:00-09:00 slot, every weekday
    const subjectId = store.addSubject('Matemática')
    const assignmentId = store.addAssignment(classId, subjectId) as string
    const teacherId = store.addTeacher('Guilherme')
    store.addAssignmentTeacher(assignmentId, teacherId)
    // Blocks the entire 08:00-09:00 slot on every weekday.
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri'] as const) {
      store.addUnavailability(teacherId, day, '07:00', '12:00')
    }

    expect(store.zeroOverlapAssignments).toEqual([{ assignmentId, teacherId, classId }])
  })

  it('does not flag an Assignment whose Teacher has some overlapping availability', () => {
    const store = useEntitiesStore()
    const { classId } = setUpSegmentWithClass(store, 1)
    const subjectId = store.addSubject('Matemática')
    const assignmentId = store.addAssignment(classId, subjectId) as string
    const teacherId = store.addTeacher('Guilherme')
    store.addAssignmentTeacher(assignmentId, teacherId)
    store.addUnavailability(teacherId, 'mon', '07:00', '12:00')

    expect(store.zeroOverlapAssignments).toEqual([])
  })
})
