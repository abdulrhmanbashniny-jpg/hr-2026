import { gregorianToHijriString, hijriToGregorian, parseYmd } from './hijri';

export const RIYADH_TZ = 'Asia/Riyadh';
const DAY_MS = 86_400_000;

export type ExpiryBucket = 'none' | 'expired' | 'd30' | 'd60' | 'd90' | 'valid';
export const BUCKETS: Exclude<ExpiryBucket, 'none'>[] = ['expired', 'd30', 'd60', 'd90', 'valid'];

/** Today's calendar date in Riyadh as YYYY-MM-DD. */
export function todayRiyadh(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: RIYADH_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function toUtcMs(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / DAY_MS);
}

/** Days from `today` until `iso` (negative when already past). */
export function daysUntil(iso: string | null | undefined, today: string): number | null {
  if (!iso) return null;
  return daysBetween(today, iso);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(toUtcMs(iso));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function bucketForDays(days: number | null): ExpiryBucket {
  if (days === null) return 'none';
  if (days <= 0) return 'expired';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'valid';
}

export function bucketFor(iso: string | null | undefined, today: string): ExpiryBucket {
  return bucketForDays(daysUntil(iso, today));
}

export function ageOn(birthIso: string | null | undefined, today: string): number | null {
  if (!birthIso) return null;
  const [by, bm, bd] = birthIso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export function isValidIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const ms = toUtcMs(iso);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === iso;
}

export function toHijri(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return gregorianToHijriString(iso);
  } catch {
    return null;
  }
}

/**
 * Converts a typed date into Gregorian ISO. Years below 1600 are treated as Hijri (Umm al-Qura),
 * which is how Saudi platforms such as Tamm export them.
 */
export function normalizeDateInput(value: string, calendar: 'gregorian' | 'hijri' | 'auto' = 'auto'): string | null {
  const parsed = parseYmd(value);
  if (!parsed) return null;
  const isHijri = calendar === 'hijri' || (calendar === 'auto' && parsed.year < 1600);
  if (isHijri) return hijriToGregorian(parsed.year, parsed.month, parsed.day);
  const iso = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
  return isValidIso(iso) ? iso : null;
}
