import { cookies, headers } from 'next/headers';
import { ar, type Dictionary } from './ar';
import { en } from './en';
import type { Locale } from './format';

export const LOCALE_COOKIE = 'mutabaa_locale';
export const THEME_COOKIE = 'mutabaa_theme';
const dictionaries: Record<Locale, Dictionary> = { ar, en };

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  if (c === 'ar' || c === 'en') return c;
  const accept = (await headers()).get('accept-language') ?? '';
  return /^en\b/i.test(accept) && !/ar/i.test(accept.split(',')[0]) ? 'en' : 'ar';
}

export async function getTheme(): Promise<'light' | 'dark' | 'system'> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function dictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export type { Dictionary, Locale };
export { countOf, f, fmtDate, fmtMoney, fmtNumber, dayCount } from './format';
