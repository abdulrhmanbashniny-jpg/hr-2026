import { toLatinDigits } from '@/lib/imports/normalize';

/** Kinds of "Contact us" message; shared by the form (client) and the server. */
export const CONTACT_CATEGORIES = ['problem', 'improvement', 'other'] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export function isContactCategory(v: unknown): v is ContactCategory {
  return typeof v === 'string' && (CONTACT_CATEGORIES as readonly string[]).includes(v);
}

/** Accepts Saudi and international mobile numbers written with Arabic or Latin digits. */
export function cleanContactPhone(raw: string): string | null {
  const s = toLatinDigits(raw).replace(/[\s\-().]/g, '');
  return /^\+?\d{8,15}$/.test(s) ? s : null;
}
