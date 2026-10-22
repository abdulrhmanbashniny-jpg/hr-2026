/** Media types accepted for uploads, identified from the file's first bytes rather than its name. */
export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic' | 'video/mp4' | 'video/quicktime' | 'video/webm' | 'application/pdf';

export function sniffMime(head: Uint8Array): SniffedType | null {
  const b = head;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 5 && ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  if (b.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand)) return 'image/heic';
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  return null;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_BY_PURPOSE = {
  portfolio: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/quicktime', 'video/webm'],
  invoice: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  document: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  product: ['image/jpeg', 'image/png', 'image/webp'],
} as const satisfies Record<string, readonly SniffedType[]>;

export type UploadPurpose = keyof typeof ALLOWED_BY_PURPOSE;

/** Some browsers report MOV as video/quicktime and HEIC photos as image/heif; treat them as one family. */
export function sameFamily(declared: string, sniffed: SniffedType): boolean {
  const norm = (m: string) => (m === 'image/heif' ? 'image/heic' : m === 'video/quicktime' ? 'video/mp4' : m);
  return norm(declared) === norm(sniffed);
}
