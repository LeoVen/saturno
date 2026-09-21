// FR-22, TR-13: `.xlsx` generation for the Human-Readable Export, built off
// the same view-model as the printable path (scheduleExport.ts, D-36) so
// the two outputs can't drift apart. Styling (fills, merges, column
// widths) is matched to the real sample sheets in `sheets/` — inspected
// directly (HorárioEF_24.08.2026_T1.xlsx): yellow (#FFFF00) bold day-name
// banner spanning each day's columns, a two-tone header row ("Horário"
// darker than the Class/Teacher name cells), Break rows filled solid
// yellow as a divider, thin borders throughout.

import ExcelJS from 'exceljs'
import type {
  ClassGridExport,
  ExportBlock,
  ExportColumn,
  TeacherGridExport,
} from './scheduleExport'

const DAY_BANNER_FILL = 'FFFFFF00'
const HEADER_PRIMARY_FILL = 'FFFFCC00'
const HEADER_SECONDARY_FILL = 'FFFFFF66'
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
}

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function writeGrid(
  sheet: ExcelJS.Worksheet,
  columns: ExportColumn[],
  blocks: ExportBlock[],
  timeColumnWidth = 14,
): void {
  sheet.getColumn(1).width = timeColumnWidth
  columns.forEach((_, i) => {
    sheet.getColumn(i + 2).width = 16
  })

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
      for (const dayCells of gridRow.cellsByDay) {
        for (const cellContent of dayCells) {
          const cell = sheet.getCell(row, col)
          cell.border = THIN_BORDER
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
          if (gridRow.kind === 'break') {
            cell.fill = fill(DAY_BANNER_FILL)
          } else if (cellContent) {
            cell.value = cellContent.lines.filter(Boolean).join('\n')
          }
          col++
        }
      }
      sheet.getRow(row).height = gridRow.kind === 'break' ? 8 : 30
      row++
    }

    row++ // blank spacer row between day-pair blocks
  }
}

/** FR-22: one workbook, one sheet per Segment (real schools keep these as separate files per Segment — bundled as sheets here for a single download). */
export function buildClassGridWorkbook(grids: ClassGridExport[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  for (const grid of grids) {
    const sheet = workbook.addWorksheet(grid.segmentName.slice(0, 31))
    writeGrid(sheet, grid.columns, grid.blocks)
  }
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
