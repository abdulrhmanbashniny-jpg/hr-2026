import { describe, expect, it } from 'vitest';
import { decideRow, isFileStale } from '@/lib/imports/diff';
import { TEMPLATES } from '@/lib/imports/templates';

const res = TEMPLATES.residents;
const stored = { iqamaNumber: '2000000001', name: 'A', occupation: 'محاسب', iqamaExpiry: '2026-12-01', iqamaExpiryHijri: '1448-06-21', passportExpiry: '2029-01-01' };

describe('smart upsert decision', () => {
  it('applies a renewal (newer dates) and its Hijri companion', () => {
    const d = decideRow(res, { ...stored, iqamaExpiry: '2027-12-01', iqamaExpiryHijri: '1449-06-22' }, stored);
    expect(d.kind).toBe('updated');
    if (d.kind === 'updated') expect(d.fields.sort()).toEqual(['iqamaExpiry', 'iqamaExpiryHijri']);
  });

  it('refuses to write an older file over newer data', () => {
    const d = decideRow(res, { ...stored, iqamaExpiry: '2025-12-01', occupation: 'عامل' }, stored);
    expect(d.kind).toBe('stale');
    if (d.kind === 'stale') expect(d.older[0]).toMatchObject({ field: 'iqamaExpiry', fileValue: '2025-12-01', currentValue: '2026-12-01' });
  });

  it('never erases a known date with an empty one', () => {
    const d = decideRow(res, { ...stored, passportExpiry: null }, stored);
    expect(d.kind).toBe('stale');
  });

  it('mixes: applies the newer date and plain fields, keeps the newer stored date', () => {
    const d = decideRow(res, { ...stored, iqamaExpiry: '2027-12-01', passportExpiry: '2028-01-01', occupation: 'مدير' }, stored);
    expect(d.kind).toBe('conflict');
    if (d.kind === 'conflict') {
      expect(d.patch).toMatchObject({ iqamaExpiry: '2027-12-01', occupation: 'مدير' });
      expect(d.patch).not.toHaveProperty('passportExpiry');
      expect(d.kept[0].field).toBe('passportExpiry');
    }
  });

  it('reports unchanged rows', () => {
    expect(decideRow(res, { ...stored }, stored).kind).toBe('unchanged');
  });

  it('GOSI has no tracked dates: always takes the latest values', () => {
    const d = decideRow(TEMPLATES.gosi, { nationalId: '1', contributoryWage: 5000 }, { nationalId: '1', contributoryWage: 4000 });
    expect(d.kind).toBe('updated');
  });

  it('flags a file as stale when half the known rows are older', () => {
    expect(isFileStale({ matched: 10, stale: 5, conflicts: 0 })).toBe(true);
    expect(isFileStale({ matched: 10, stale: 2, conflicts: 1 })).toBe(false);
    expect(isFileStale({ matched: 0, stale: 0, conflicts: 0 })).toBe(false);
  });
});
