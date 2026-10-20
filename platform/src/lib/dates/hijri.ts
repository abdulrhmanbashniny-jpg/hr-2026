/**
 * Umm al-Qura (the official Saudi Hijri calendar) conversion.
 *
 * Gregorian → Hijri uses the ICU `islamic-umalqura` calendar exposed through Intl, which carries the
 * official month-length table for 1300–1600 AH. Hijri → Gregorian has no direct Intl API, so we
 * estimate with the arithmetic (tabular) calendar and then search the few surrounding days for the
 * date whose Umm al-Qura rendering matches exactly. Invalid dates (e.g. 30 in a 29-day month) return null.
 */

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const DAY_MS = 86_400_000;

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function gregorianToHijri(iso: string): HijriDate {
  const parts = formatter.formatToParts(new Date(isoToUtcMs(iso)));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function formatHijri(h: HijriDate): string {
  return `${h.year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`;
}

export function gregorianToHijriString(iso: string): string {
  return formatHijri(gregorianToHijri(iso));
}

/** Tabular Islamic calendar → Julian day number (used only as a starting estimate). */
function tabularHijriToJdn(y: number, m: number, d: number): number {
  return d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948439 - 1;
}

function jdnToUtcMs(jdn: number): number {
  // JDN 2440588 = 1970-01-01
  return (jdn - 2440588) * DAY_MS;
}

export function hijriToGregorian(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1300 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 30) return null;
  const estimate = jdnToUtcMs(tabularHijriToJdn(year, month, day));
  for (let offset = 0; offset <= 4; offset++) {
    for (const sign of offset === 0 ? [0] : [-1, 1]) {
      const ms = estimate + sign * offset * DAY_MS;
      const h = gregorianToHijri(utcMsToIso(ms));
      if (h.year === year && h.month === month && h.day === day) return utcMsToIso(ms);
    }
  }
  return null;
}

/** Parses "1449-08-23", "1449/8/23" or "23/08/1449" (Hijri) into a Gregorian ISO date. */
export function hijriStringToGregorian(value: string): string | null {
  const m = parseYmd(value);
  if (!m) return null;
  return hijriToGregorian(m.year, m.month, m.day);
}

export function parseYmd(value: string): HijriDate | null {
  const s = value.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return { year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) };
  return null;
}
