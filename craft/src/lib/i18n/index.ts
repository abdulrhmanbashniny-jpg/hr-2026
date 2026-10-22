import { cookies } from 'next/headers';
import { ar, type Dictionary } from './ar';
import { en } from './en';
import type { Locale } from './format';

export const LOCALE_COOKIE = 'hirfa_locale';
const dictionaries: Record<Locale, Dictionary> = { ar, en };

/** Arabic unless the visitor picked English with the language switch; many Saudi phones run in English. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return c === 'en' ? 'en' : 'ar';
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
