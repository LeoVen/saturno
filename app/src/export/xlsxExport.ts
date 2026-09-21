// FR-22, TR-13: `.xlsx` generation for the Human-Readable Export, built off
// the same view-model as the printable path (scheduleExport.ts, D-36) so
// the two outputs can't drift apart. Layout (fills, merges, column widths)
// is matched to the real sample sheets in `sheets/` — inspected directly
// (HorárioEF_24.08.2026_T1.xlsx): a bold day-name banner spanning each
// day's columns, a two-tone header row ("Horário" darker than the
// Class/Teacher name cells), Break rows filled solid as a divider, thin
// borders throughout. Colors are light blue rather than the real sheets'
// yellow (user request 2026-09-21, "for now" — i.e. not a final palette
// decision).

import ExcelJS from 'exceljs'
import type {
  ClassGridExport,
  ExportBlock,
  ExportColumn,
  TeacherGridExport,
} from './scheduleExport'
import type { Weekday } from '../entities/weekday'
import {
  writeManifest,
  XLSX_MANIFEST_FORMAT_VERSION,
  type ManifestCell,
  type ManifestSheet,
} from './xlsxManifest'

const DAY_BANNER_FILL = 'FFBFDBFE'
const HEADER_PRIMARY_FILL = 'FF93C5FD'
const HEADER_SECONDARY_FILL = 'FFDBEAFE'
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
}
/** Slightly bigger than the real sample sheets' ~16-wide columns — chosen so real names (e.g. "Educação Física", "Guilherme") fit without every column looking cramped; a long outlier just wraps (TR-13's "comparable," not "auto-fit"). */
const DATA_COLUMN_WIDTH = 18

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

/** `lines[0]` (e.g. the Teacher, per scheduleExport.ts) rendered bigger/bold; any further line smaller and muted — mirrors ExportGridTable.vue's `.primary-line`/`<small>` split so the preview and the .xlsx read the same way. */
function richTextValue(lines: string[]): ExcelJS.CellValue | undefined {
  const nonEmpty = lines.filter(Boolean)
  if (nonEmpty.length === 0) return undefined
  if (nonEmpty.length === 1) return nonEmpty[0]
  const [primary, ...rest] = nonEmpty
  return {
    richText: [
      { font: { size: 12, bold: true }, text: primary! },
      ...rest.map((text) => ({
        font: { size: 9, color: { argb: 'FF666666' } },
        text: `\n${text}`,
      })),
    ],
  }
}

/** E15: invoked for every data (period, not break) cell as it's written, so the caller can build the re-import manifest without re-deriving layout separately. */
type RecordCell = (
  row: number,
  col: number,
  columnKey: string,
  weekday: Weekday,
  timeSlotId: string,
) => void

function writeGrid(
  sheet: ExcelJS.Worksheet,
  columns: ExportColumn[],
  blocks: ExportBlock[],
  timeColumnWidth = 14,
  recordCell?: RecordCell,
): void {
  sheet.getColumn(1).width = timeColumnWidth
  // Every day-block's columns must be sized, not just the first day's —
  // blocks pair up to 2 days side by side (Mon+Tue, Wed+Thu; Fri alone),
  // and each day repeats the same `columns.length` columns.
  const maxDaysPerBlock = Math.max(1, ...blocks.map((b) => b.days.length))
  for (let i = 0; i < maxDaysPerBlock * columns.length; i++) {
    sheet.getColumn(i + 2).width = DATA_COLUMN_WIDTH
  }

  let row = 1
  for (const block of blocks) {
    // Day-name banner row, merged across each day's block of columns.
    let col = 2
    for (const day of block.days) {
      const first = sheet.getCell(row, col)
      first.value = day.label
      sheet.mergeCells(row, col, row, col + columns.length - 1)
      col += columns.length
    }
    for (let c = 1; c <= 1 + block.days.length * columns.length; c++) {
      const cell = sheet.getCell(row, c)
      cell.fill = fill(DAY_BANNER_FILL)
      cell.font = { bold: true, size: 12 }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = THIN_BORDER
    }
    row++

    // Column header row: "Horário" + one column-label group per day.
    const headerRow = row
    const horarioCell = sheet.getCell(headerRow, 1)
    horarioCell.value = 'Horário'
    horarioCell.fill = fill(HEADER_PRIMARY_FILL)
    horarioCell.font = { bold: true }
    horarioCell.alignment = { horizontal: 'center', vertical: 'middle' }
    horarioCell.border = THIN_BORDER
    col = 2
    for (let d = 0; d < block.days.length; d++) {
      for (const c of columns) {
        const cell = sheet.getCell(headerRow, col)
        cell.value = c.label
        cell.fill = fill(HEADER_SECONDARY_FILL)
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = THIN_BORDER
        col++
      }
    }
    row++

    // One row per Time Slot/Break in the Segment's row plan.
    for (const gridRow of block.rows) {
      const timeCell = sheet.getCell(row, 1)
      timeCell.value = gridRow.timeLabel
      timeCell.border = THIN_BORDER
      timeCell.alignment = { horizontal: 'center', vertical: 'middle' }
      if (gridRow.kind === 'break') {
        timeCell.fill = fill(DAY_BANNER_FILL)
        timeCell.font = { bold: true }
      } else {
        timeCell.fill = fill(HEADER_SECONDARY_FILL)
        timeCell.font = { bold: true }
      }

      col = 2
      for (let d = 0; d < block.days.length; d++) {
        const weekday = block.days[d]!.weekday
        const dayCells = gridRow.cellsByDay[d]!
        for (let ci = 0; ci < dayCells.length; ci++) {
          const cellContent = dayCells[ci]
          const cell = sheet.getCell(row, col)
          cell.border = THIN_BORDER
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          if (gridRow.kind === 'break') {
            cell.fill = fill(DAY_BANNER_FILL)
          } else if (cellContent) {
            const value = richTextValue(cellContent.lines)
            if (value !== undefined) cell.value = value
          }
          if (gridRow.kind === 'period' && gridRow.timeSlotId && recordCell) {
            recordCell(row, col, columns[ci]!.key, weekday, gridRow.timeSlotId)
          }
          col++
        }
      }
      sheet.getRow(row).height = gridRow.kind === 'break' ? 8 : 34
      row++
    }

    row++ // blank spacer row between day-pair blocks
  }
}

/**
 * FR-22: one workbook, one sheet per Segment (real schools keep these as
 * separate files per Segment — bundled as sheets here for a single
 * download). E15: also carries a hidden re-import manifest (see
 * xlsxManifest.ts) — this is the one workbook shape `xlsxImport.ts` can read
 * back; `buildTeacherGridWorkbook` stays export-only, it's a derived view of
 * the same data.
 */
export function buildClassGridWorkbook(grids: ClassGridExport[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const manifestSheets: ManifestSheet[] = []
  for (const grid of grids) {
    const sheetName = grid.segmentName.slice(0, 31)
    const sheet = workbook.addWorksheet(sheetName)
    const cells: ManifestCell[] = []
    writeGrid(sheet, grid.columns, grid.blocks, 14, (row, col, classId, weekday, timeSlotId) => {
      cells.push({ row, col, classId, weekday, timeSlotId })
    })
    manifestSheets.push({ sheetName, segmentId: grid.segmentId, cells })
  }
  writeManifest(workbook, {
    formatVersion: XLSX_MANIFEST_FORMAT_VERSION,
    kind: 'class-grid',
    sheets: manifestSheets,
  })
  return workbook
}

/** FR-22: one workbook, one sheet per (Teacher, Segment). */
export function buildTeacherGridWorkbook(grids: TeacherGridExport[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const usedNames = new Set<string>()
  for (const grid of grids) {
    let name = `${grid.teacherLabel} - ${grid.segmentName}`.slice(0, 31)
    let suffix = 2
    while (usedNames.has(name)) {
      name = `${grid.teacherLabel} - ${grid.segmentName}`.slice(0, 28) + ` ${suffix}`
      suffix++
    }
    usedNames.add(name)
    const sheet = workbook.addWorksheet(name)
    writeGrid(sheet, grid.columns, grid.blocks)
  }
  return workbook
}

export async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string,
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
