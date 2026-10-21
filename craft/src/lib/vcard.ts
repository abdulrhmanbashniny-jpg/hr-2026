const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

/** vCard 3.0 (the version iOS and Android contacts import without prompts). */
export function buildVCard(input: { name: string; title: string; phone: string | null; url: string; note: string; city: string }): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(input.name)}`,
    `N:${esc(input.name)};;;;`,
    `TITLE:${esc(input.title)}`,
    `ORG:${esc('حِرفة · Hirfa')}`,
    ...(input.phone ? [`TEL;TYPE=CELL:${input.phone}`] : []),
    `URL:${input.url}`,
    `ADR;TYPE=WORK:;;;${esc(input.city)};;;SA`,
    `NOTE:${esc(input.note)}`,
    'END:VCARD',
  ];
  return lines.join('\r\n') + '\r\n';
}
