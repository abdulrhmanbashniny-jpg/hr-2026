import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { inspectXlsxZip } from '@/lib/imports/zip-guard';

async function workbook(sheets: number, rowsPerSheet: number) {
  const wb = new ExcelJS.Workbook();
  for (let s = 0; s < sheets; s++) {
    const ws = wb.addWorksheet(`S${s}`);
    for (let r = 0; r < rowsPerSheet; r++) ws.addRow(['x'.repeat(40), r, 'y'.repeat(40)]);
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe('xlsx zip guard', () => {
  it('accepts an ordinary workbook', async () => {
    const r = inspectXlsxZip(await workbook(1, 200));
    expect(r.ok).toBe(true);
  });

  it('refuses archives over the uncompressed budget or with too many sheets', async () => {
    const big = await workbook(1, 20_001);
    expect(inspectXlsxZip(big, { maxEntries: 400, maxUncompressedBytes: 1_000_000, maxEntryRatio: 200, maxWorksheets: 25 })).toEqual({ ok: false, problem: 'too_large' });
    const many = await workbook(30, 1);
    expect(inspectXlsxZip(many)).toEqual({ ok: false, problem: 'too_many_sheets' });
  });

  it('refuses data that is not a zip archive', () => {
    expect(inspectXlsxZip(new TextEncoder().encode('not a spreadsheet at all, just text'))).toEqual({ ok: false, problem: 'not_zip' });
  });
});
