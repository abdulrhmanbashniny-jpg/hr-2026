import { describe, expect, it } from 'vitest';
import { dammCheckDigit, generateReferralCode, isDammValid, isWeakCode, parseReferralCode } from '@/lib/codes/damm';
import { digitsOnly, normalizeDigits } from '@/lib/digits';

describe('Damm referral codes', () => {
  it('matches the published Damm example (572 → 4)', () => {
    expect(dammCheckDigit('572')).toBe(4);
    expect(isDammValid('5724')).toBe(true);
  });

  it('generates six-digit codes that validate and are never weak', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const code = generateReferralCode(rnd);
      expect(code).toMatch(/^[1-9]\d{5}$/);
      expect(isDammValid(code)).toBe(true);
      expect(isWeakCode(code)).toBe(false);
    }
  });

  it('catches every single-digit error and adjacent transposition', () => {
    const code = generateReferralCode(() => 0.4242);
    for (let i = 0; i < code.length; i++) {
      for (let d = 0; d <= 9; d++) {
        if (String(d) === code[i]) continue;
        const typo = code.slice(0, i) + d + code.slice(i + 1);
        expect(isDammValid(typo)).toBe(false);
      }
      if (i < code.length - 1 && code[i] !== code[i + 1]) {
        const swapped = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
        expect(isDammValid(swapped)).toBe(false);
      }
    }
  });

  it('parses what people type, including Arabic-Indic digits and spaces', () => {
    const code = generateReferralCode(() => 0.31);
    const arabic = code.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
    expect(parseReferralCode(` ${arabic.slice(0, 3)} ${arabic.slice(3)} `)).toEqual({ ok: true, code });
    expect(parseReferralCode('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseReferralCode('1234')).toEqual({ ok: false, reason: 'length' });
    const bad = code.slice(0, 5) + String((Number(code[5]) + 1) % 10);
    expect(parseReferralCode(bad)).toEqual({ ok: false, reason: 'checksum' });
  });

  it('flags weak patterns', () => {
    for (const c of ['111111', '123456', '654321', '012345', '121212', '123123']) expect(isWeakCode(c)).toBe(true);
    expect(isWeakCode('839214')).toBe(false);
  });
});

describe('digits', () => {
  it('normalises Arabic-Indic and Persian digits', () => {
    expect(normalizeDigits('٠٥٥ ۱۲۳')).toBe('055 123');
    expect(digitsOnly('+966 (٥٥) 123-4567')).toBe('966551234567');
  });
});
