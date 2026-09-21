import { describe, expect, it } from 'vitest'
import { applyMigrations, CURRENT_SCHEMA_VERSION } from './migrations'

describe('applyMigrations', () => {
  it('is a no-op when already at the current schemaVersion', () => {
    const data = { foo: 'bar' }
    expect(applyMigrations(data, CURRENT_SCHEMA_VERSION)).toBe(data)
  })

  // No version-step migrations exist yet (schemaVersion 1 is the first
  // shape this app has ever exported) — once one is added (e.g.
  // migrateV1ToV2), its own describe block goes here, testing it in
  // isolation per TR-11/E11-T5, alongside a test that applyMigrations
  // chains multiple steps in order for a file several versions behind.
})
