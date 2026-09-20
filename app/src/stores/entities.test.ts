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
})
