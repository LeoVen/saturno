// E15: re-import the "Por Turma" `.xlsx` (buildClassGridWorkbook) back into
// a Schedule. Entities (Segments/Classes/Subjects/Teachers/Time Slots) are
// never created here — they must already exist in the current profile
// (manual entry stays the only way to bootstrap them, per specs/FR.md's
// "legacy spreadsheet import" note; this is round-tripping Saturno's own
// export, not ingesting an arbitrary teacher-made file). Cell identity
// (which Class/weekday/Time Slot a position is) comes from the hidden
// manifest, not from re-deriving layout or trusting visible labels — see
// xlsxManifest.ts. All-or-nothing: any unresolvable cell fails the whole
// import rather than silently dropping or misassigning it.

import type ExcelJS from 'exceljs'
import type { EntitiesSnapshot } from '../persistence/exportImport'
import type { PlacedPeriod, Schedule } from '../wasm/types'
import { readManifest } from './xlsxManifest'

export type XlsxImportResult = { ok: true; schedule: Schedule } | { ok: false; errors: string[] }

function columnLetter(col: number): string {
  let letters = ''
  let n = col
  while (n > 0) {
    const rem = (n - 1) % 26
    letters = String.fromCharCode(65 + rem) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

/** Reverses D-17's `teacherLabelFor` disambiguation: a bare name if unique, `"Nome (2)"` for the 2nd+ Teacher sharing that name. */
function resolveTeacherId(entities: EntitiesSnapshot, label: string): string | undefined {
  const trimmed = label.trim()
  const match = /^(.*) \((\d+)\)$/.exec(trimmed)
  if (match) {
    const name = match[1]!
    const idx = Number(match[2]) - 1
    const sameName = entities.teachers.filter((t) => t.name === name)
    return sameName[idx]?.id
  }
  const exact = entities.teachers.filter((t) => t.name === trimmed)
  return exact.length === 1 ? exact[0]!.id : undefined
}

function resolveSubjectId(entities: EntitiesSnapshot, name: string): string | undefined {
  const trimmed = name.trim()
  return entities.subjects.find((s) => s.name === trimmed)?.id
}

/** Mirrors xlsxExport.ts's `richTextValue`: a single line comes back as a plain string, 2+ lines as `richText` runs. */
function cellLines(value: ExcelJS.CellValue): string[] {
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }
  if (value && typeof value === 'object' && 'richText' in value) {
    const text = (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('')
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  }
  return []
}

export function importClassGridWorkbook(
  workbook: ExcelJS.Workbook,
  entities: EntitiesSnapshot,
): XlsxImportResult {
  const manifest = readManifest(workbook)
  if (!manifest) {
    return {
      ok: false,
      errors: [
        'Arquivo inválido: este .xlsx não contém os dados internos que o Saturno usa para reconhecer a grade. Ele precisa ser um arquivo "Por Turma" baixado do próprio Saturno, sem planilhas renomeadas ou removidas.',
      ],
    }
  }

  const classIds = new Set(entities.classes.map((c) => c.id))
  const timeSlotIds = new Set(entities.segments.flatMap((s) => s.timeSlots.map((t) => t.id)))

  const placements: PlacedPeriod[] = []
  const errors: string[] = []

  for (const manifestSheet of manifest.sheets) {
    const sheet = workbook.getWorksheet(manifestSheet.sheetName)
    if (!sheet) {
      errors.push(
        `A planilha "${manifestSheet.sheetName}" não foi encontrada no arquivo (foi renomeada ou removida?).`,
      )
      continue
    }
    for (const cellRef of manifestSheet.cells) {
      // A Class or Time Slot removed since export has nothing left to attach
      // this cell to — skip it rather than fail the whole import over it.
      if (!classIds.has(cellRef.classId) || !timeSlotIds.has(cellRef.timeSlotId)) continue

      const lines = cellLines(sheet.getCell(cellRef.row, cellRef.col).value)
      if (lines.length === 0) continue // blank cell: no placement for this slot

      const [teacherLabel, subjectName] = lines
      const teacherId = teacherLabel ? resolveTeacherId(entities, teacherLabel) : undefined
      const subjectId = subjectName ? resolveSubjectId(entities, subjectName) : undefined
      if (!teacherId || !subjectId) {
        const ref = `${sheet.name}!${columnLetter(cellRef.col)}${cellRef.row}`
        errors.push(
          `Célula ${ref}: não foi possível reconhecer "${lines.join(' / ')}" — verifique se o professor e a disciplina têm exatamente esse nome cadastrado.`,
        )
        continue
      }

      placements.push({
        classId: cellRef.classId,
        subjectId,
        teacherId,
        weekday: cellRef.weekday,
        timeSlotId: cellRef.timeSlotId,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, schedule: { placements, jointSessionPlacements: [] } }
}
