import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useScheduleVersionsStore } from './scheduleVersions'
import type { Schedule } from '../wasm/types'

const SAMPLE_SCHEDULE: Schedule = {
  placements: [
    { classId: 'c1', subjectId: 's1', teacherId: 't1', weekday: 'mon', timeSlotId: 'slot1' },
  ],
}

describe('scheduleVersions store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no versions and no active version', () => {
    const store = useScheduleVersionsStore()
    expect(store.versions).toEqual([])
    expect(store.activeVersion).toBeUndefined()
  })

  it('creates a version from a Schedule and makes it active (E07-T2)', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)

    expect(store.versions).toHaveLength(1)
    expect(store.versionById(id)?.name).toBe('2026')
    expect(store.activeVersionId).toBe(id)
    expect(store.activeVersion?.schedule.placements).toHaveLength(1)
  })

  it('duplicates a version as an independent copy and activates it (FR-24)', () => {
    const store = useScheduleVersionsStore()
    const originalId = store.createFromSchedule('2026', SAMPLE_SCHEDULE)

    const copyId = store.duplicate(originalId, '2026 - rascunho')
    expect(copyId).toBeDefined()
    expect(store.versions).toHaveLength(2)
    expect(store.versionById(copyId!)?.name).toBe('2026 - rascunho')
    expect(store.versionById(copyId!)?.duplicatedFromId).toBe(originalId)
    expect(store.activeVersionId).toBe(copyId)

    // Independent copy: mutating one's schedule must not affect the other.
    store.versionById(copyId!)!.schedule.placements.push({
      classId: 'c2',
      subjectId: 's2',
      teacherId: 't2',
      weekday: 'tue',
      timeSlotId: 'slot2',
    })
    expect(store.versionById(originalId)?.schedule.placements).toHaveLength(1)
    expect(store.versionById(copyId!)?.schedule.placements).toHaveLength(2)
  })

  it('duplicating a non-existent version is a no-op', () => {
    const store = useScheduleVersionsStore()
    expect(store.duplicate('missing', 'x')).toBeUndefined()
    expect(store.versions).toHaveLength(0)
  })

  it('renames a version', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)
    store.rename(id, '2026 - final')
    expect(store.versionById(id)?.name).toBe('2026 - final')
  })

  it('switches the active version (FR-24)', () => {
    const store = useScheduleVersionsStore()
    const a = store.createFromSchedule('A', SAMPLE_SCHEDULE)
    const b = store.createFromSchedule('B', SAMPLE_SCHEDULE)
    expect(store.activeVersionId).toBe(b)

    expect(store.setActive(a)).toBe(true)
    expect(store.activeVersionId).toBe(a)
    expect(store.activeVersion?.name).toBe('A')
  })

  it('refuses to switch to a non-existent version', () => {
    const store = useScheduleVersionsStore()
    const a = store.createFromSchedule('A', SAMPLE_SCHEDULE)
    expect(store.setActive('missing')).toBe(false)
    expect(store.activeVersionId).toBe(a)
  })

  it('removing the active version falls back to another version, or none', () => {
    const store = useScheduleVersionsStore()
    const a = store.createFromSchedule('A', SAMPLE_SCHEDULE)
    const b = store.createFromSchedule('B', SAMPLE_SCHEDULE)
    store.setActive(b)

    store.remove(b)
    expect(store.versions).toHaveLength(1)
    expect(store.activeVersionId).toBe(a)

    store.remove(a)
    expect(store.versions).toHaveLength(0)
    expect(store.activeVersionId).toBe('')
  })

  it('moves a placement within a Class (FR-17)', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)

    const changed = store.movePlacement(
      id,
      { classId: 'c1', weekday: 'mon', timeSlotId: 'slot1' },
      { classId: 'c1', weekday: 'tue', timeSlotId: 'slot2' },
    )
    expect(changed).toBe(true)
    expect(store.versionById(id)?.schedule.placements).toEqual([
      { classId: 'c1', subjectId: 's1', teacherId: 't1', weekday: 'tue', timeSlotId: 'slot2' },
    ])
  })

  it('movePlacement on a non-existent version is a no-op', () => {
    const store = useScheduleVersionsStore()
    expect(
      store.movePlacement(
        'missing',
        { classId: 'c1', weekday: 'mon', timeSlotId: 'slot1' },
        { classId: 'c1', weekday: 'tue', timeSlotId: 'slot2' },
      ),
    ).toBe(false)
  })

  it('adds, edits, and removes a slot-level Note (FR-19)', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)
    expect(store.notesFor(id)).toEqual([])

    const slot = { classId: 'c1', weekday: 'mon' as const, timeSlotId: 'slot1' }
    const noteId = store.addNote(id, 'Professor trocado por indisponibilidade', slot)
    expect(noteId).toBeDefined()
    expect(store.notesFor(id)).toHaveLength(1)
    expect(store.noteForSlot(id, slot)?.text).toBe('Professor trocado por indisponibilidade')

    store.updateNote(id, noteId!, 'Motivo atualizado')
    expect(store.noteForSlot(id, slot)?.text).toBe('Motivo atualizado')

    store.removeNote(id, noteId!)
    expect(store.notesFor(id)).toEqual([])
    expect(store.noteForSlot(id, slot)).toBeUndefined()
  })

  it('adds a whole-schedule Note (no slot) distinct from a slot-level one', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)

    store.addNote(id, 'Observação geral sobre esta versão')
    store.addNote(id, 'Nota específica', { classId: 'c1', weekday: 'mon', timeSlotId: 'slot1' })

    const notes = store.notesFor(id)
    expect(notes).toHaveLength(2)
    expect(notes.filter((n) => !n.slot)).toHaveLength(1)
    expect(notes.filter((n) => n.slot)).toHaveLength(1)
  })

  it('ignores an empty/whitespace-only Note', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)
    expect(store.addNote(id, '   ')).toBeUndefined()
    expect(store.notesFor(id)).toEqual([])
  })

  it('notesFor defaults to [] for a version with no notes field at all (pre-E09 data)', () => {
    const store = useScheduleVersionsStore()
    const id = store.createFromSchedule('2026', SAMPLE_SCHEDULE)
    delete store.versionById(id)!.notes
    expect(store.notesFor(id)).toEqual([])
  })
})
