import { consoleAr, type ConsoleDictionary } from './console-ar';
import { consoleEn } from './console-en';
import type { Locale } from './format';

export function consoleDictionary(locale: Locale): ConsoleDictionary {
  return locale === 'en' ? consoleEn : consoleAr;
}

export type { ConsoleDictionary };
