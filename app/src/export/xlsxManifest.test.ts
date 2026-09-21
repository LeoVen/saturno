import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import {
  readManifest,
  writeManifest,
  XLSX_MANIFEST_FORMAT_VERSION,
  type XlsxManifest,
} from './xlsxManifest'

describe('xlsxManifest', () => {
  it('round-trips through a hidden sheet, including through a full buffer save/load', async () => {
    const manifest: XlsxManifest = {
      formatVersion: XLSX_MANIFEST_FORMAT_VERSION,
      kind: 'class-grid',
      sheets: [
        {
          sheetName: 'Ensino Fundamental',
          segmentId: 'seg-1',
          cells: [
            { row: 3, col: 2, classId: 'c-1', weekday: 'mon', timeSlotId: 'ts-1' },
            { row: 3, col: 3, classId: 'c-2', weekday: 'mon', timeSlotId: 'ts-1' },
          ],
        },
      ],
    }
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Ensino Fundamental')
    writeManifest(workbook, manifest)

    const hiddenSheet = workbook.getWorksheet('_saturno_meta')!
    expect(hiddenSheet.state).toBe('veryHidden')
    expect(readManifest(workbook)).toEqual(manifest)

    const buffer = await workbook.xlsx.writeBuffer()
    const reloaded = new ExcelJS.Workbook()
    await reloaded.xlsx.load(buffer)
    expect(readManifest(reloaded)).toEqual(manifest)
  })

  it('chunks a large manifest across multiple cells and still round-trips', () => {
    const cells = Array.from({ length: 5000 }, (_, i) => ({
      row: i,
      col: 2,
      classId: `c-${i}`,
      weekday: 'mon' as const,
      timeSlotId: 'ts-1',
    }))
    const manifest: XlsxManifest = {
      formatVersion: XLSX_MANIFEST_FORMAT_VERSION,
      kind: 'class-grid',
      sheets: [{ sheetName: 'S', segmentId: 'seg-1', cells }],
    }
    const workbook = new ExcelJS.Workbook()
    writeManifest(workbook, manifest)
    expect(workbook.getWorksheet('_saturno_meta')!.rowCount).toBeGreaterThan(1)
    expect(readManifest(workbook)).toEqual(manifest)
  })

  it('returns undefined for a workbook with no manifest sheet, or a corrupted one', () => {
    const plain = new ExcelJS.Workbook()
    plain.addWorksheet('Sheet1')
    expect(readManifest(plain)).toBeUndefined()

    const corrupted = new ExcelJS.Workbook()
    const meta = corrupted.addWorksheet('_saturno_meta')
    meta.getCell(1, 1).value = 'not json'
    expect(readManifest(corrupted)).toBeUndefined()

    const wrongVersion = new ExcelJS.Workbook()
    const meta2 = wrongVersion.addWorksheet('_saturno_meta')
    meta2.getCell(1, 1).value = JSON.stringify({
      formatVersion: 99,
      kind: 'class-grid',
      sheets: [],
    })
    expect(readManifest(wrongVersion)).toBeUndefined()
  })
})
