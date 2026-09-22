import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const dbMock = vi.hoisted(() => ({
  readStoreState: vi.fn(),
  writeStoreState: vi.fn(),
  deleteStoreState: vi.fn(),
}))
vi.mock('../persistence/db', () => dbMock)

import { useProfilesStore } from './profiles'

describe('profiles store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    dbMock.readStoreState.mockReset()
    dbMock.writeStoreState.mockReset()
    dbMock.deleteStoreState.mockReset()
  })

  it('starts empty', () => {
    const store = useProfilesStore()
    expect(store.items).toEqual([])
    expect(store.activeProfile).toBeUndefined()
  })

  it('create() adds a blank Profile and activates it', () => {
    const store = useProfilesStore()
    const id = store.create('2026', 'verde')

    expect(store.items).toHaveLength(1)
    expect(store.byId(id)).toMatchObject({ name: '2026', color: 'verde' })
    expect(store.activeProfileId).toBe(id)
  })

  it('create() falls back to a default name/color when none given', () => {
    const store = useProfilesStore()
    const id = store.create('   ')
    expect(store.byId(id)?.name).toBe('Novo Perfil')
    expect(store.byId(id)?.color).toBe('azul')
  })

  it("duplicate() deep-copies the source Profile's saved data under a new id and activates it", async () => {
    const store = useProfilesStore()
    const sourceId = store.create('2026', 'azul')

    dbMock.readStoreState.mockImplementation((key: string) => {
      if (key === `${sourceId}:entities`) return Promise.resolve({ segments: [{ id: 'seg-1' }] })
      if (key === `${sourceId}:scheduleVersions`)
        return Promise.resolve({ versions: [], activeVersionId: '' })
      return Promise.resolve(undefined)
    })

    const newId = await store.duplicate(sourceId, '2027', 'roxo')

    expect(newId).toBeDefined()
    expect(store.items).toHaveLength(2)
    expect(store.byId(newId!)).toMatchObject({ name: '2027', color: 'roxo' })
    expect(store.activeProfileId).toBe(newId)
    expect(dbMock.writeStoreState).toHaveBeenCalledWith(`${newId}:entities`, {
      segments: [{ id: 'seg-1' }],
    })
    expect(dbMock.writeStoreState).toHaveBeenCalledWith(`${newId}:scheduleVersions`, {
      versions: [],
      activeVersionId: '',
    })
  })

  it('duplicate() returns undefined for an unknown source, touching no storage', async () => {
    const store = useProfilesStore()
    const result = await store.duplicate('missing', 'x')
    expect(result).toBeUndefined()
    expect(dbMock.writeStoreState).not.toHaveBeenCalled()
  })

  it('rename()/setColor() update in place, ignoring a blank rename', () => {
    const store = useProfilesStore()
    const id = store.create('2026')
    store.rename(id, '  2026 (renomeado)  ')
    store.setColor(id, 'laranja')
    expect(store.byId(id)).toMatchObject({ name: '2026 (renomeado)', color: 'laranja' })

    store.rename(id, '   ')
    expect(store.byId(id)?.name).toBe('2026 (renomeado)') // unchanged
  })

  it('setActive() switches only for a known id', () => {
    const store = useProfilesStore()
    const a = store.create('A')
    store.create('B') // becomes active
    expect(store.setActive(a)).toBe(true)
    expect(store.activeProfileId).toBe(a)
    expect(store.setActive('missing')).toBe(false)
    expect(store.activeProfileId).toBe(a)
  })

  it('remove() refuses to delete the only remaining Profile', async () => {
    const store = useProfilesStore()
    const id = store.create('Only')
    const result = await store.remove(id)
    expect(result).toEqual({ ok: false, error: expect.stringContaining('único Perfil') })
    expect(store.items).toHaveLength(1)
    expect(dbMock.deleteStoreState).not.toHaveBeenCalled()
  })

  it('remove() deletes a non-active Profile and its storage', async () => {
    const store = useProfilesStore()
    const a = store.create('A')
    const b = store.create('B')
    store.setActive(a)

    const result = await store.remove(b)
    expect(result).toEqual({ ok: true })
    expect(store.items.map((p) => p.id)).toEqual([a])
    expect(store.activeProfileId).toBe(a) // unaffected, B wasn't active
    expect(dbMock.deleteStoreState).toHaveBeenCalledWith(`${b}:entities`)
    expect(dbMock.deleteStoreState).toHaveBeenCalledWith(`${b}:scheduleVersions`)
  })

  it('remove() falls back to another Profile when the active one is deleted', async () => {
    const store = useProfilesStore()
    const a = store.create('A')
    const b = store.create('B') // active

    const result = await store.remove(b)
    expect(result).toEqual({ ok: true })
    expect(store.activeProfileId).toBe(a)
  })
})
