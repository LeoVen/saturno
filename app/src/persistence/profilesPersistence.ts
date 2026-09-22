// INTERLUDE-2: orchestrates Profile-aware persistence. The thin,
// IndexedDB-touching half of profilesBootstrap.ts's pure migration plan,
// plus keeping `entities`/`scheduleVersions` hydrated from — and
// write-through persisted to — whichever Profile is currently active.
//
// `initProfilePersistence` must run (and be awaited) once, before the app
// mounts (see main.ts): every screen's first read of `entities`/
// `scheduleVersions` has to already see the right Profile's data, and the
// `profiles` store itself needs its own possible first-load migration
// finished before anything else hydrates.

import type { Pinia } from 'pinia'
import { watch } from 'vue'
import { DEFAULT_PROFILE_COLOR } from '../entities/profile'
import { useProfilesStore } from '../stores/profiles'
import { useEntitiesStore } from '../stores/entities'
import { useScheduleVersionsStore } from '../stores/scheduleVersions'
import { deleteStoreState, readStoreState, writeStoreState } from './db'
import { profileScopedKey } from './profileScoping'
import { isValidProfilesState, planProfileMigration, type ProfilesState } from './profilesBootstrap'

const PROFILES_KEY = 'profiles'
/** Pre-INTERLUDE-2 keys — bare store ids, before Profile-scoping existed. */
const LEGACY_ENTITIES_KEY = 'entities'
const LEGACY_SCHEDULE_VERSIONS_KEY = 'scheduleVersions'

async function loadOrMigrateProfiles(): Promise<ProfilesState> {
  const saved = await readStoreState(PROFILES_KEY)
  if (isValidProfilesState(saved)) return saved

  const [legacyEntities, legacyScheduleVersions] = await Promise.all([
    readStoreState(LEGACY_ENTITIES_KEY),
    readStoreState(LEGACY_SCHEDULE_VERSIONS_KEY),
  ])
  const plan = planProfileMigration(legacyEntities, legacyScheduleVersions, {
    id: crypto.randomUUID(),
    name: 'Meu Perfil',
    color: DEFAULT_PROFILE_COLOR,
    createdAt: new Date().toISOString(),
  })

  await Promise.all(plan.writes.map((w) => writeStoreState(w.key, w.value)))
  await Promise.all(plan.deletes.map((k) => deleteStoreState(k)))
  await writeStoreState(PROFILES_KEY, plan.state)
  return plan.state
}

export async function initProfilePersistence(pinia: Pinia): Promise<void> {
  const profiles = useProfilesStore(pinia)
  const entities = useEntitiesStore(pinia)
  const scheduleVersions = useScheduleVersionsStore(pinia)

  const initial = await loadOrMigrateProfiles()
  profiles.$patch(initial)
  profiles.$subscribe((_mutation, state) => void writeStoreState(PROFILES_KEY, state), {
    detached: true,
  })

  let unsubscribeActiveProfile: (() => void) | undefined

  async function loadActiveProfileData(): Promise<void> {
    unsubscribeActiveProfile?.()
    const profileId = profiles.activeProfileId

    const [entitiesState, scheduleVersionsState] = await Promise.all([
      readStoreState(profileScopedKey(profileId, 'entities')),
      readStoreState(profileScopedKey(profileId, 'scheduleVersions')),
    ])
    if (entitiesState !== undefined) entities.$patch(entitiesState as never)
    else entities.$reset()
    if (scheduleVersionsState !== undefined) scheduleVersions.$patch(scheduleVersionsState as never)
    else scheduleVersions.$reset()

    const unsubEntities = entities.$subscribe(
      (_mutation, state) => void writeStoreState(profileScopedKey(profileId, 'entities'), state),
      { detached: true },
    )
    const unsubScheduleVersions = scheduleVersions.$subscribe(
      (_mutation, state) =>
        void writeStoreState(profileScopedKey(profileId, 'scheduleVersions'), state),
      { detached: true },
    )
    unsubscribeActiveProfile = () => {
      unsubEntities()
      unsubScheduleVersions()
    }
  }

  await loadActiveProfileData()
  watch(
    () => profiles.activeProfileId,
    () => void loadActiveProfileData(),
  )
}
