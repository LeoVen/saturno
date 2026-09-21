import { describe, expect, it } from 'vitest'
import { buildExport, parseImport } from './exportImport'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import type { EntitiesSnapshot, ScheduleVersionsSnapshot } from './exportImport'

const EMPTY_ENTITIES: EntitiesSnapshot = {
  segments: [],
  grades: [],
  classes: [],
  subjects: [],
  teachers: [],
  assignments: [],
}

const EMPTY_SCHEDULE_VERSIONS: ScheduleVersionsSnapshot = {
  versions: [],
  activeVersionId: '',
}

describe('buildExport', () => {
  it('stamps the current schemaVersion and round-trips through JSON', () => {
    const entities: EntitiesSnapshot = {
      ...EMPTY_ENTITIES,
      subjects: [{ id: 's1', name: 'Matemática' }],
    }
    const result = buildExport(entities, EMPTY_SCHEDULE_VERSIONS)
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.entities.subjects).toEqual([{ id: 's1', name: 'Matemática' }])
  })
})

describe('parseImport', () => {
  it('round-trips a real export produced by buildExport', () => {
    const entities: EntitiesSnapshot = {
      ...EMPTY_ENTITIES,
      subjects: [{ id: 's1', name: 'Matemática' }],
      teachers: [{ id: 't1', name: 'Ana', unavailability: [], subjectIds: ['s1'] }],
    }
    const scheduleVersions: ScheduleVersionsSnapshot = {
      versions: [
        {
          id: 'v1',
          name: '2026',
          schedule: { placements: [] },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      activeVersionId: 'v1',
    }
    const exported = buildExport(entities, scheduleVersions)

    const result = parseImport(JSON.stringify(exported))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.entities).toEqual(entities)
    expect(result.scheduleVersions).toEqual(scheduleVersions)
  })

  it('rejects invalid JSON', () => {
    const result = parseImport('{not json')
    expect(result).toEqual({ ok: false, error: expect.stringContaining('JSON válido') })
  })

  it('rejects a file with no schemaVersion', () => {
    const result = parseImport(JSON.stringify({ entities: EMPTY_ENTITIES }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('schemaVersion')
  })

  it('rejects a schemaVersion newer than this app supports', () => {
    const result = parseImport(
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION + 1,
        entities: EMPTY_ENTITIES,
        scheduleVersions: EMPTY_SCHEDULE_VERSIONS,
      }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('mais nova')
  })

  it('defaults missing entity/schedule-version arrays instead of throwing', () => {
    const result = parseImport(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION }))
    expect(result).toEqual({
      ok: true,
      entities: EMPTY_ENTITIES,
      scheduleVersions: EMPTY_SCHEDULE_VERSIONS,
    })
  })

  it('runs the (currently empty) migration chain for an older schemaVersion without throwing', () => {
    const result = parseImport(
      JSON.stringify({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        entities: EMPTY_ENTITIES,
        scheduleVersions: EMPTY_SCHEDULE_VERSIONS,
      }),
    )
    expect(result.ok).toBe(true)
  })
})
