const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC_INDIC = '۰۱۲۳۴۵۶۷۸۹';

/** Converts Arabic-Indic and Persian digits to ASCII so "٨٣٩٢١٤" and "839214" are the same input. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    if (a >= 0) {
      out += String(a);
      continue;
    }
    const e = EXTENDED_ARABIC_INDIC.indexOf(ch);
    out += e >= 0 ? String(e) : ch;
  }
  return out;
}

/** Keeps digits only, after normalising Arabic-Indic digits. */
export function digitsOnly(input: string): string {
  return normalizeDigits(input).replace(/\D/g, '');
}
