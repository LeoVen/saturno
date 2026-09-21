// FR-23, TR-7, TR-12: full-state native export/import — every entity,
// constraint, Schedule Version, and its Notes, as a single structured
// (not hand-editable) JSON file, versioned per TR-8.

import type { Segment } from '../entities/segment'
import type { Grade } from '../entities/grade'
import type { Class } from '../entities/class'
import type { Subject } from '../entities/subject'
import type { Teacher } from '../entities/teacher'
import type { Assignment } from '../entities/assignment'
import type { JointSession } from '../entities/jointSession'
import type { ScheduleVersion } from '../entities/scheduleVersion'
import { CURRENT_SCHEMA_VERSION, applyMigrations } from './migrations'

export interface EntitiesSnapshot {
  segments: Segment[]
  grades: Grade[]
  classes: Class[]
  subjects: Subject[]
  teachers: Teacher[]
  assignments: Assignment[]
  /** Optional — absent on any Native Export File from before E10 (TR-8); `normalizeEntities` below defaults it to `[]`, so downstream code can treat it as always present. */
  jointSessions?: JointSession[]
}

export interface ScheduleVersionsSnapshot {
  versions: ScheduleVersion[]
  activeVersionId: string
}

export interface ExportedData {
  schemaVersion: number
  entities: EntitiesSnapshot
  scheduleVersions: ScheduleVersionsSnapshot
}

/** Structured-clone through JSON (same reasoning as persistence/db.ts and the solver worker boundary): strips Pinia-reactive Proxies before this leaves the app. */
export function buildExport(
  entities: EntitiesSnapshot,
  scheduleVersions: ScheduleVersionsSnapshot,
): ExportedData {
  return JSON.parse(
    JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      entities,
      scheduleVersions,
    }),
  ) as ExportedData
}

export type ImportResult =
  | { ok: true; entities: EntitiesSnapshot; scheduleVersions: ScheduleVersionsSnapshot }
  | { ok: false; error: string }

function normalizeEntities(raw: unknown): EntitiesSnapshot {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<EntitiesSnapshot>
  return {
    segments: Array.isArray(r.segments) ? r.segments : [],
    grades: Array.isArray(r.grades) ? r.grades : [],
    classes: Array.isArray(r.classes) ? r.classes : [],
    subjects: Array.isArray(r.subjects) ? r.subjects : [],
    teachers: Array.isArray(r.teachers) ? r.teachers : [],
    assignments: Array.isArray(r.assignments) ? r.assignments : [],
    jointSessions: Array.isArray(r.jointSessions) ? r.jointSessions : [],
  }
}

function normalizeScheduleVersions(raw: unknown): ScheduleVersionsSnapshot {
  const r = (
    typeof raw === 'object' && raw !== null ? raw : {}
  ) as Partial<ScheduleVersionsSnapshot>
  return {
    versions: Array.isArray(r.versions) ? r.versions : [],
    activeVersionId: typeof r.activeVersionId === 'string' ? r.activeVersionId : '',
  }
}

/**
 * Parses and validates an imported file's raw text. TR-8: a newer
 * `schemaVersion` than this build understands is rejected outright with a
 * clear pt-BR message — the app never guesses at an unknown future shape.
 * An older version runs through the migration chain first.
 */
export function parseImport(raw: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Arquivo inválido: o conteúdo não é um JSON válido.' }
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Arquivo inválido: formato inesperado.' }
  }
  const obj = data as Record<string, unknown>
  const schemaVersion = obj.schemaVersion
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    return { ok: false, error: 'Arquivo inválido: "schemaVersion" ausente ou inválida.' }
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Este arquivo foi exportado por uma versão mais nova do Saturno (schemaVersion ${schemaVersion}); esta versão do aplicativo só entende até a versão ${CURRENT_SCHEMA_VERSION}. Atualize o aplicativo antes de importar este arquivo.`,
    }
  }
  const migrated = applyMigrations(obj, schemaVersion)
  return {
    ok: true,
    entities: normalizeEntities(migrated.entities),
    scheduleVersions: normalizeScheduleVersions(migrated.scheduleVersions),
  }
}
