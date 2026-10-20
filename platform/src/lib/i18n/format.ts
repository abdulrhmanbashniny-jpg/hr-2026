import { arDays, enDays } from '@/lib/rules/text';

export type Locale = 'ar' | 'en';

/** Replaces {name} placeholders. */
export function f(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function fmtNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

export function fmtMoney(n: number | null | undefined, locale: Locale): string {
  if (n === null || n === undefined) return '—';
  const v = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Math.round(n));
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

export function dayCount(n: number, locale: Locale): string {
  return locale === 'ar' ? arDays(n) : enDays(n);
}

const NOUNS = {
  company: { ar: ['شركة واحدة', 'شركتان', 'شركات', 'شركة'], en: ['company', 'companies'] },
  user: { ar: ['مستخدم واحد', 'مستخدمان', 'مستخدمين', 'مستخدم'], en: ['user', 'users'] },
  payment: { ar: ['عملية دفع واحدة', 'عمليتا دفع', 'عمليات دفع', 'عملية دفع'], en: ['payment', 'payments'] },
} as const;

/** "3 شركات", "11 شركة", "شركتان" / "3 companies": a count with its noun in the right Arabic number form. */
export function countOf(n: number, noun: keyof typeof NOUNS, locale: Locale): string {
  const w = NOUNS[noun];
  if (locale === 'en') return `${fmtNumber(n)} ${n === 1 ? w.en[0] : w.en[1]}`;
  if (n === 1) return w.ar[0];
  if (n === 2) return w.ar[1];
  if (n >= 3 && n <= 10) return `${n} ${w.ar[2]}`;
  return `${fmtNumber(n)} ${w.ar[3]}`;
}
