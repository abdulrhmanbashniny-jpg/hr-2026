export type Locale = 'ar' | 'en';

/** Replaces {name} placeholders. */
export function f(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

export function fmtCompact(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fmtMoney(n: number | null | undefined, locale: Locale, digits = 0): string {
  if (n === null || n === undefined) return '—';
  const v = new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  return locale === 'ar' ? `${v} ر.س` : `SAR ${v}`;
}

/** Compact money for tiles: 123.7K ر.س / SAR 1.2M. */
export function fmtMoneyCompact(n: number, locale: Locale): string {
  const v = n >= 10_000 ? fmtCompact(n) : fmtNumber(n);
  return locale === 'ar' ? `${v} ر.س` : `SAR ${v}`;
}

export function fmtDate(iso: string | Date | null | undefined, locale: Locale, withTime = false): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d);
}

export function fmtMonthYear(iso: string | Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function fmtRelative(iso: string | Date, locale: Locale, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 30 * 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
  return fmtDate(iso, locale);
}

/** The code as people read it off a card: 839 214. */
export function fmtCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
