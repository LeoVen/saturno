// E15: the hidden manifest that makes the "Por Turma" `.xlsx` re-importable.
// A visible cell only carries a Teacher/Subject *name* (D-17-style label) —
// nothing in the visible grid says which Class/weekday/Time Slot a given
// cell position actually is. Rather than re-deriving that from the current
// entities (fragile if they've drifted since export) or guessing from
// labels, the workbook carries a `veryHidden` sheet with the exact
// row/col → (classId, weekday, timeSlotId) mapping recorded at export time.
// xlsxImport.ts trusts this manifest, not sheet content, for cell identity.

import ExcelJS from 'exceljs'
import type { Weekday } from '../entities/weekday'

export const XLSX_MANIFEST_FORMAT_VERSION = 1
const MANIFEST_SHEET_NAME = '_saturno_meta'
/** Excel's per-cell string limit is 32767 chars; chunked well under that. */
const CHUNK_SIZE = 30000

export interface ManifestCell {
  row: number
  col: number
  classId: string
  weekday: Weekday
  timeSlotId: string
}

export interface ManifestSheet {
  sheetName: string
  segmentId: string
  cells: ManifestCell[]
}

export interface XlsxManifest {
  formatVersion: number
  kind: 'class-grid'
  sheets: ManifestSheet[]
}

/** Adds the manifest as its own hidden sheet — call last, after every visible sheet exists. */
export function writeManifest(workbook: ExcelJS.Workbook, manifest: XlsxManifest): void {
  const sheet = workbook.addWorksheet(MANIFEST_SHEET_NAME)
  sheet.state = 'veryHidden'
  const json = JSON.stringify(manifest)
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    sheet.getCell(i / CHUNK_SIZE + 1, 1).value = json.slice(i, i + CHUNK_SIZE)
  }
}

/** `undefined` means "no manifest" — either not a Saturno file, or the hidden sheet was removed/renamed. */
export function readManifest(workbook: ExcelJS.Workbook): XlsxManifest | undefined {
  const sheet = workbook.getWorksheet(MANIFEST_SHEET_NAME)
  if (!sheet) return undefined
  let json = ''
  sheet.eachRow((row) => {
    const value = row.getCell(1).value
    if (typeof value === 'string') json += value
  })
  try {
    const parsed = JSON.parse(json) as Partial<XlsxManifest>
    if (parsed.formatVersion !== XLSX_MANIFEST_FORMAT_VERSION || parsed.kind !== 'class-grid') {
      return undefined
    }
    return parsed as XlsxManifest
  } catch {
    return undefined
  }
}
