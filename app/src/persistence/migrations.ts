// TR-8: schema versioning & migration. One pure function per version step
// (`migrateV1ToV2`, etc.), applied in order on import for a file whose
// `schemaVersion` is older than what this app currently produces. Empty
// for now — schemaVersion 1 is the first (and so far only) shape this app
// has ever exported — this is where a future step gets added without
// touching exportImport.ts's own parsing logic.

/** The schemaVersion this build of the app exports and fully understands. */
export const CURRENT_SCHEMA_VERSION = 1

type SchemaData = Record<string, unknown>
type Migration = (data: SchemaData) => SchemaData

/** Keyed by the version a migration moves *from* (e.g. `1` migrates v1 -> v2). */
const MIGRATIONS: Record<number, Migration> = {}

/** Runs every migration step from `fromVersion` up to `CURRENT_SCHEMA_VERSION`, in order. */
export function applyMigrations(data: SchemaData, fromVersion: number): SchemaData {
  let result = data
  for (let version = fromVersion; version < CURRENT_SCHEMA_VERSION; version++) {
    const migrate = MIGRATIONS[version]
    if (migrate) result = migrate(result)
  }
  return result
}
