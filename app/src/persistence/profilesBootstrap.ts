// INTERLUDE-2: the pure planning half of Profile bootstrap — deciding what
// the first-ever load should do, kept separate from profilesPersistence.ts's
// actual IndexedDB reads/writes so it's unit-testable without one (TR-11
// convention: the pure decision is tested directly, the thin I/O wrapper
// around it is exercised via agent-driven Playwright verification instead,
// same split as migrations.ts/exportImport.ts).

import type { Profile } from '../entities/profile'
import { profileScopedKey } from './profileScoping'

export interface ProfilesState {
  items: Profile[]
  activeProfileId: string
}

export function isValidProfilesState(saved: unknown): saved is ProfilesState {
  if (typeof saved !== 'object' || saved === null) return false
  const s = saved as Partial<ProfilesState>
  return Array.isArray(s.items) && s.items.length > 0 && typeof s.activeProfileId === 'string'
}

export interface MigrationWrite {
  key: string
  value: unknown
}

export interface MigrationPlan {
  state: ProfilesState
  /** Keys to write under the new Profile's namespace — only for whichever of entities/scheduleVersions actually had pre-existing (unscoped) data. */
  writes: MigrationWrite[]
  /** The old, now-superseded unscoped keys to remove ('entities'/'scheduleVersions' — never anything else). */
  deletes: string[]
}

/**
 * First-ever load, no `profiles` record yet: wrap whatever pre-INTERLUDE-2
 * unscoped `entities`/`scheduleVersions` data exists (if any — a truly
 * fresh install has none) into one default Profile rather than losing it.
 * `newProfile` is injected (not generated internally) to keep this
 * deterministic and testable.
 */
export function planProfileMigration(
  legacyEntities: unknown,
  legacyScheduleVersions: unknown,
  newProfile: Profile,
): MigrationPlan {
  const writes: MigrationWrite[] = []
  const deletes: string[] = []

  if (legacyEntities !== undefined) {
    writes.push({ key: profileScopedKey(newProfile.id, 'entities'), value: legacyEntities })
    deletes.push('entities')
  }
  if (legacyScheduleVersions !== undefined) {
    writes.push({
      key: profileScopedKey(newProfile.id, 'scheduleVersions'),
      value: legacyScheduleVersions,
    })
    deletes.push('scheduleVersions')
  }

  return {
    state: { items: [newProfile], activeProfileId: newProfile.id },
    writes,
    deletes,
  }
}
