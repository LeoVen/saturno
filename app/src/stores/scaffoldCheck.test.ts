import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useScaffoldCheckStore } from './scaffoldCheck'

// E01-T6: establishes the Vitest pattern later epics' pure-function and
// store tests (TR-11) will follow.
describe('scaffoldCheckStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no saved timestamp', () => {
    const store = useScaffoldCheckStore()
    expect(store.lastSavedAt).toBeNull()
  })

  it('records an ISO timestamp when touched', () => {
    const store = useScaffoldCheckStore()
    store.touch()
    expect(store.lastSavedAt).not.toBeNull()
    expect(() => new Date(store.lastSavedAt as string)).not.toThrow()
  })
})
