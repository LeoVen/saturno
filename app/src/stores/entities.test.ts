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
