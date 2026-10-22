import { digitsOnly } from '@/lib/digits';

/**
 * Damm algorithm (totally anti-symmetric quasigroup of order 10). A trailing check digit computed
 * with this table catches every single-digit error and every adjacent transposition, which are the
 * two mistakes people make when reading a code off a card or typing it on a phone.
 */
const TABLE = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2],
  [7, 0, 9, 2, 1, 5, 4, 8, 6, 3],
  [4, 2, 0, 6, 8, 7, 1, 3, 5, 9],
  [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8],
  [3, 6, 7, 4, 2, 0, 9, 5, 8, 1],
  [5, 8, 6, 9, 7, 2, 0, 1, 3, 4],
  [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5],
  [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];

function interim(digits: string): number {
  let row = 0;
  for (const ch of digits) row = TABLE[row][ch.charCodeAt(0) - 48];
  return row;
}

export function dammCheckDigit(payload: string): number {
  if (!/^\d+$/.test(payload)) throw new Error('Damm payload must be digits');
  return interim(payload);
}

export function isDammValid(code: string): boolean {
  return /^\d{2,}$/.test(code) && interim(code) === 0;
}

export const REFERRAL_CODE_LENGTH = 6;

/** Codes nobody should be handed: one repeated digit, straight runs, palindromes-of-two, leading zero. */
export function isWeakCode(code: string): boolean {
  if (code.startsWith('0')) return true;
  if (/^(\d)\1+$/.test(code)) return true;
  const asc = '01234567890123456789';
  const desc = '98765432109876543210';
  if (asc.includes(code) || desc.includes(code)) return true;
  if (/^(\d\d)\1+$/.test(code) || /^(\d{3})\1$/.test(code)) return true;
  return false;
}

/** A random code of `length` digits whose last digit is the Damm check digit. */
export function generateReferralCode(random: () => number = Math.random, length = REFERRAL_CODE_LENGTH): string {
  for (;;) {
    let payload = String(1 + Math.floor(random() * 9));
    while (payload.length < length - 1) payload += String(Math.floor(random() * 10));
    const code = payload + String(dammCheckDigit(payload));
    if (!isWeakCode(code)) return code;
  }
}

export type CodeCheck = { ok: true; code: string } | { ok: false; reason: 'empty' | 'length' | 'checksum' };

/** Validates what a person typed (Arabic-Indic digits, spaces and dashes allowed). */
export function parseReferralCode(input: string, lengths: number[] = [REFERRAL_CODE_LENGTH, REFERRAL_CODE_LENGTH + 1]): CodeCheck {
  const code = digitsOnly(input);
  if (!code) return { ok: false, reason: 'empty' };
  if (!lengths.includes(code.length)) return { ok: false, reason: 'length' };
  if (!isDammValid(code)) return { ok: false, reason: 'checksum' };
  return { ok: true, code };
}
