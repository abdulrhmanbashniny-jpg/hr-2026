/**
 * An .xlsx file is a ZIP archive. Before handing it to the spreadsheet parser, read the ZIP central
 * directory (a few kilobytes at the end of the file) and refuse archives that would expand into
 * far more data than a government export ever holds: too many entries, too much uncompressed
 * data, an extreme compression ratio, or too many worksheets. Nothing is decompressed here.
 */
export const XLSX_LIMITS = {
  maxEntries: 400,
  maxUncompressedBytes: 80 * 1024 * 1024,
  maxEntryRatio: 200,
  maxWorksheets: 25,
};

export type ZipProblem = 'not_zip' | 'too_many_entries' | 'too_large' | 'ratio' | 'too_many_sheets' | 'zip64';

export function inspectXlsxZip(bytes: Uint8Array, limits = XLSX_LIMITS): { ok: true; uncompressed: number; entries: number; sheets: number } | { ok: false; problem: ZipProblem } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: signature 0x06054b50, within the last 64 KiB + 22 bytes.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return { ok: false, problem: 'not_zip' };
  const total = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) return { ok: false, problem: 'zip64' };
  if (total > limits.maxEntries) return { ok: false, problem: 'too_many_entries' };
  if (cdOffset + cdSize > bytes.length) return { ok: false, problem: 'not_zip' };

  let p = cdOffset;
  let uncompressed = 0;
  let sheets = 0;
  for (let n = 0; n < total; n++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) return { ok: false, problem: 'not_zip' };
    const compressedSize = view.getUint32(p + 20, true);
    const size = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    if (size === 0xffffffff || compressedSize === 0xffffffff) return { ok: false, problem: 'zip64' };
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) sheets++;
    uncompressed += size;
    if (uncompressed > limits.maxUncompressedBytes) return { ok: false, problem: 'too_large' };
    if (size > 1024 * 1024 && size / Math.max(compressedSize, 1) > limits.maxEntryRatio) return { ok: false, problem: 'ratio' };
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (sheets > limits.maxWorksheets) return { ok: false, problem: 'too_many_sheets' };
  return { ok: true, uncompressed, entries: total, sheets };
}
