/** Saudi numbers to international format without '+': 05xxxxxxxx → 9665xxxxxxxx. */
export function normalizeSaudiPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('05') && d.length === 10) d = `966${d.slice(1)}`;
  if (d.startsWith('5') && d.length === 9) d = `966${d}`;
  return d.length >= 10 ? d : null;
}

/** Hybrid mode: a ready wa.me link with the formatted message. */
export function waDeepLink(phone: string | null | undefined, text: string): string {
  const to = normalizeSaudiPhone(phone);
  return `https://wa.me/${to ?? ''}?text=${encodeURIComponent(text)}`;
}
