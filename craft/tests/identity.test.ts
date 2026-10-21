import { describe, expect, it } from 'vitest';
import { isValidSaudiId, isValidVatNumber } from '@/lib/ids';
import { formatLocal, maskPhone, normalizeSaudiMobile, waNumber } from '@/lib/phone';

function withLuhn(nine: string): string {
  for (let c = 0; c <= 9; c++) {
    const id = nine + c;
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      let n = Number(id[i]);
      if (i % 2 === 0) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
    }
    if (sum % 10 === 0) return id;
  }
  throw new Error('unreachable');
}

describe('Saudi mobile numbers', () => {
  it.each([
    ['0551234567', '+966551234567'],
    ['551234567', '+966551234567'],
    ['966551234567', '+966551234567'],
    ['+966 55 123 4567', '+966551234567'],
    ['00966551234567', '+966551234567'],
    ['٠٥٥١٢٣٤٥٦٧', '+966551234567'],
  ])('%s → %s', (input, out) => expect(normalizeSaudiMobile(input)).toBe(out));

  it.each(['0451234567', '05512345', '+971551234567', 'abc', ''])('rejects %s', (input) => expect(normalizeSaudiMobile(input)).toBeNull());

  it('masks and formats', () => {
    expect(maskPhone('+966551234567')).toBe('05•• ••• 567');
    expect(formatLocal('+966551234567')).toBe('055 123 4567');
    expect(waNumber('+966551234567')).toBe('966551234567');
  });
});

describe('Saudi ID and VAT numbers', () => {
  it('accepts IDs and iqamas with a valid check digit', () => {
    expect(isValidSaudiId(withLuhn('108765432'))).toBe(true);
    expect(isValidSaudiId(withLuhn('234567890'))).toBe(true);
  });

  it('rejects wrong check digits, prefixes and lengths', () => {
    const good = withLuhn('108765432');
    const bad = good.slice(0, 9) + String((Number(good[9]) + 1) % 10);
    expect(isValidSaudiId(bad)).toBe(false);
    expect(isValidSaudiId(withLuhn('308765432'))).toBe(false);
    expect(isValidSaudiId('12345')).toBe(false);
  });

  it('validates VAT registration numbers', () => {
    expect(isValidVatNumber('310122393500003')).toBe(true);
    expect(isValidVatNumber('300000000000002')).toBe(false);
    expect(isValidVatNumber('31012239350000')).toBe(false);
  });
});
