import { digitsOnly } from '@/lib/digits';

/**
 * Normalises a Saudi mobile number to E.164 (+9665XXXXXXXX). Accepts 05…, 5…, 9665…, +9665…,
 * 009665… with spaces, dashes and Arabic-Indic digits. Returns null for anything else.
 */
export function normalizeSaudiMobile(input: string): string | null {
  let d = digitsOnly(input);
  if (d.startsWith('00966')) d = d.slice(5);
  else if (d.startsWith('966')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return /^5\d{8}$/.test(d) ? `+966${d}` : null;
}

/** +966512345678 → 05•• ••• 678 (enough to recognise, not enough to call). */
export function maskPhone(e164: string): string {
  const local = `0${e164.replace(/^\+966/, '')}`;
  return `${local.slice(0, 2)}•• ••• ${local.slice(-3)}`;
}

/** +966512345678 → 966512345678 (the form wa.me expects). */
export function waNumber(e164: string): string {
  return e164.replace(/^\+/, '');
}

/** +966512345678 → 051 234 5678 */
export function formatLocal(e164: string): string {
  const local = `0${e164.replace(/^\+966/, '')}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
