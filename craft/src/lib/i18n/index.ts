import { cookies, headers } from 'next/headers';
import { ar, type Dictionary } from './ar';
import { en } from './en';
import type { Locale } from './format';

export const LOCALE_COOKIE = 'hirfa_locale';
const dictionaries: Record<Locale, Dictionary> = { ar, en };

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const c = jar.get(LOCALE_COOKIE)?.value;
  if (c === 'ar' || c === 'en') return c;
  const accept = (await headers()).get('accept-language') ?? '';
  return /^en\b/i.test(accept) ? 'en' : 'ar';
}

export function dictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export type { Dictionary, Locale };
export { f, fmtCode, fmtCompact, fmtDate, fmtMoney, fmtMoneyCompact, fmtMonthYear, fmtNumber, fmtRelative } from './format';
