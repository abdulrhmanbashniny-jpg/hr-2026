import type { FieldValue } from './types';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const i = ARABIC_INDIC.indexOf(ch);
    return String(i >= 0 ? i : PERSIAN.indexOf(ch));
  });
}

/** Normalizes Arabic text for matching: hamza forms, ta marbuta, alef maqsura, tatweel, diacritics, spaces. */
export function normalizeArabic(s: string): string {
  return toLatinDigits(s)
    .replace(/[ً-ْٰ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const headerKey = normalizeArabic;

const NULL_TOKENS = new Set(['', '-', '--', '—', '–', 'n/a', 'na', 'null', 'none', 'لا يوجد', '.']);

export function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  if (NULL_TOKENS.has(s.toLowerCase())) return null;
  return s;
}

/** National IDs, iqama, sequence and employer numbers: digits only, no float artefacts. */
export function cleanId(v: unknown): string | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return Number.isInteger(v) ? String(v) : String(Math.round(v));
  }
  const s = cleanText(v);
  if (s === null) return null;
  let out = toLatinDigits(s).replace(/^'/, '').replace(/\s+/g, '');
  if (/^\d+\.0+$/.test(out)) out = out.replace(/\.0+$/, '');
  return out || null;
}

/**
 * Card numbers that a government export sometimes stores as a decimal (e.g. 33.00434161). A float
 * loses trailing zeros (33.0043416 for 33.00434160), so numbers are re-rendered with the fixed
 * eight-digit fraction these cards use; text stays as exported.
 */
export function cleanCardNumber(v: unknown, fractionDigits = 8): string | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(fractionDigits);
  }
  const s = cleanText(v);
  return s === null ? null : toLatinDigits(s).replace(/\s+/g, '');
}

export function cleanNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = cleanText(v);
  if (s === null) return null;
  const n = Number(toLatinDigits(s).replace(/[,\s٬]/g, '').replace('٫', '.'));
  return Number.isFinite(n) ? n : null;
}

export function cleanInt(v: unknown): number | null {
  const n = cleanNumber(v);
  return n === null ? null : Math.trunc(n);
}

const TRUE_TOKENS = new Set(['نعم', 'yes', 'y', 'true', '1', 'صح']);
const FALSE_TOKENS = new Set(['لا', 'no', 'n', 'false', '0', 'خطا']);

export function cleanBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = cleanText(v);
  if (s === null) return null;
  const k = normalizeArabic(s);
  if (TRUE_TOKENS.has(k)) return true;
  if (FALSE_TOKENS.has(k)) return false;
  return null;
}

export function valuesEqual(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  const na = a === undefined ? null : a;
  const nb = b === undefined ? null : b;
  if (typeof na === 'number' && typeof nb === 'number') return Math.abs(na - nb) < 0.005;
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb) && na !== null && nb !== null;
  return na === nb;
}
