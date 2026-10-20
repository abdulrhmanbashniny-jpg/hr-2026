import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildDataset } from '@/db/seed-data';
import { parseTemplate } from '@/lib/imports/parse';
import { buildSampleWorkbook } from '@/lib/imports/samples';
import { ImportError, TEMPLATE_KEYS } from '@/lib/imports/types';

const TODAY = '2026-10-20';
const data = buildDataset(TODAY);

describe('government template parser', () => {
  it.each(TEMPLATE_KEYS)('auto-detects and reads %s', async (key) => {
    const buf = await buildSampleWorkbook(key, data);
    const r = await parseTemplate(new Uint8Array(buf));
    expect(r.template).toBe(key);
    expect(r.errors).toEqual([]);
    const expected = { residents: data.residents, gosi: data.gosi, vehicles: data.vehicles, operating_cards: data.operatingCards, driver_cards: data.driverCards }[key];
    expect(r.rows).toHaveLength(expected.length);
  });

  it('GOSI: drops the blank merged columns and filler rows, trims nationality, reads wages as numbers', async () => {
    const r = await parseTemplate(new Uint8Array(await buildSampleWorkbook('gosi', data)), 'gosi');
    expect(r.ignoredColumns).toEqual([]);
    const saudi = r.rows.find((x) => x.values.isSaudi);
    expect(saudi?.values.nationality).toBe('السعودية');
    const first = r.rows[0].values;
    expect(typeof first.basicWage).toBe('number');
    expect(first.joinDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Tamm: converts Hijri dates, maps "-" to null and ignores the duplicate status column', async () => {
    const r = await parseTemplate(new Uint8Array(await buildSampleWorkbook('vehicles', data)), 'vehicles');
    expect(r.ignoredColumns).toEqual(['وضع المركبة']);
    const v = data.vehicles[0];
    const row = r.rows.find((x) => x.key === v.sequenceNumber)!;
    expect(row.values.licenseExpiry).toBe(v.licenseExpiry);
    expect(row.values.licenseExpiryHijri).toMatch(/^14\d{2}-\d{2}-\d{2}$/);
    const noUser = r.rows.find((x) => x.values.actualUserId === null);
    expect(noUser).toBeDefined();
    expect(noUser!.values.actualUserName).toBeNull();
  });

  it('driver cards: keeps every digit of card numbers stored as decimals', async () => {
    const r = await parseTemplate(new Uint8Array(await buildSampleWorkbook('driver_cards', data)), 'driver_cards');
    expect(r.rows.map((x) => x.values.cardNumber).sort()).toEqual(data.driverCards.map((c) => c.cardNumber).sort());
  });

  it('finds the header below title rows and trims header spaces', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ورقة1');
    ws.addRow(['تقرير بطاقات التشغيل']);
    ws.addRow([]);
    ws.addRow([' رقم البطاقة ', 'الرقم التسلسلي', 'النشاط', 'تاريخ الإصدار ', 'تاريخ الانتهاء', 'الحالة']);
    ws.addRow(['33-00000001', 123456789, 'نقل', new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'), 'نشط']);
    const r = await parseTemplate(new Uint8Array(await wb.xlsx.writeBuffer()), 'operating_cards');
    expect(r.headerRow).toBe(3);
    expect(r.rows[0].values).toMatchObject({ cardNumber: '33-00000001', sequenceNumber: '123456789', expiryDate: '2027-01-01' });
  });

  it('rejects a file uploaded to the wrong template with the detected one', async () => {
    const buf = await buildSampleWorkbook('vehicles', data);
    await expect(parseTemplate(new Uint8Array(buf), 'residents')).rejects.toMatchObject({ code: 'template_mismatch', details: { detected: 'vehicles' } });
  });

  it('rejects files that are not xlsx', async () => {
    await expect(parseTemplate(new TextEncoder().encode('not a workbook'))).rejects.toBeInstanceOf(ImportError);
  });

  it('reports rows with an invalid key instead of importing them', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('المقيمين النشطين');
    ws.addRow(['رقم الاقامة', 'الاسم', 'تاريخ انتهاء الاقامة']);
    ws.addRow(['2123456789', 'سليم', '2027-01-01']);
    ws.addRow(['12345', 'رقم قصير', '2027-01-01']);
    const r = await parseTemplate(new Uint8Array(await wb.xlsx.writeBuffer()), 'residents');
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.missingOptionalColumns.length).toBeGreaterThan(0);
  });
});
