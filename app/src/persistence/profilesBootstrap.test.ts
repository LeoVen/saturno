import { describe, expect, it } from 'vitest'
import { isValidProfilesState, planProfileMigration } from './profilesBootstrap'
import type { Profile } from '../entities/profile'

const newProfile: Profile = {
  id: 'profile-1',
  name: 'Meu Perfil',
  color: 'azul',
  createdAt: '2026-09-22T00:00:00.000Z',
}

describe('isValidProfilesState', () => {
  it('accepts a well-formed ProfilesState with at least one Profile', () => {
    expect(isValidProfilesState({ items: [newProfile], activeProfileId: 'profile-1' })).toBe(true)
  })

  it('rejects missing/malformed/empty state', () => {
    expect(isValidProfilesState(undefined)).toBe(false)
    expect(isValidProfilesState(null)).toBe(false)
    expect(isValidProfilesState({})).toBe(false)
    expect(isValidProfilesState({ items: [], activeProfileId: '' })).toBe(false)
    expect(isValidProfilesState({ items: [newProfile] })).toBe(false) // no activeProfileId
    expect(isValidProfilesState({ items: 'nope', activeProfileId: 'x' })).toBe(false)
  })
})

describe('planProfileMigration', () => {
  it('wraps pre-existing unscoped entities/scheduleVersions into the new default Profile', () => {
    const legacyEntities = { segments: [{ id: 'seg-1' }] }
    const legacyScheduleVersions = { versions: [], activeVersionId: '' }

    const plan = planProfileMigration(legacyEntities, legacyScheduleVersions, newProfile)

    expect(plan.state).toEqual({ items: [newProfile], activeProfileId: 'profile-1' })
    expect(plan.writes).toEqual(
      expect.arrayContaining([
        { key: 'profile-1:entities', value: legacyEntities },
        { key: 'profile-1:scheduleVersions', value: legacyScheduleVersions },
      ]),
    )
    expect(plan.writes).toHaveLength(2)
    expect(plan.deletes.sort()).toEqual(['entities', 'scheduleVersions'])
  })

  it('produces no writes/deletes on a truly fresh install (no legacy data at all)', () => {
    const plan = planProfileMigration(undefined, undefined, newProfile)

    expect(plan.state).toEqual({ items: [newProfile], activeProfileId: 'profile-1' })
    expect(plan.writes).toEqual([])
    expect(plan.deletes).toEqual([])
  })

  it('handles only one of entities/scheduleVersions having pre-existing data', () => {
    const plan = planProfileMigration({ segments: [] }, undefined, newProfile)

    expect(plan.writes).toEqual([{ key: 'profile-1:entities', value: { segments: [] } }])
    expect(plan.deletes).toEqual(['entities'])
  })
})
