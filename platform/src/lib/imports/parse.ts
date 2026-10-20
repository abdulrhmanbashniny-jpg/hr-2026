import ExcelJS from 'exceljs';
import { isValidIso, normalizeDateInput, toHijri } from '@/lib/dates';
import { parseYmd } from '@/lib/dates/hijri';
import { cleanBool, cleanCardNumber, cleanId, cleanInt, cleanNumber, cleanText, headerKey, normalizeArabic } from './normalize';
import { TEMPLATES, type FieldDef, type TemplateDef } from './templates';
import { ImportError, TEMPLATE_KEYS, type FieldValue, type NormalizedRecord, type ParseResult, type ParsedRow, type RowIssue, type TemplateKey } from './types';

const HEADER_SCAN_ROWS = 20;
export const MAX_ROWS = 20_000;

type Cell = ExcelJS.Cell;

/** Reads the primitive value of a cell; slave cells of a merged range read as empty. */
function cellValue(cell: Cell): unknown {
  if (cell.isMerged && cell.master && cell.master.address !== cell.address) return null;
  const v = cell.value as unknown;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('');
    if ('result' in o) return o.result instanceof Date ? o.result : (o.result ?? null);
    if ('text' in o) return o.text;
    if ('error' in o) return null;
    return null;
  }
  return v;
}

function dateToIso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Excel serial date (1900 system) → ISO. */
function serialToIso(serial: number): string | null {
  if (serial < 1 || serial > 2_958_465) return null;
  return dateToIso(new Date(Math.round((serial - 25569) * 86_400_000)));
}

interface DateResult {
  iso: string | null;
  hijri: string | null;
  invalid: boolean;
}

function readDate(raw: unknown): DateResult {
  if (raw instanceof Date) {
    const iso = dateToIso(raw);
    return { iso, hijri: toHijri(iso), invalid: false };
  }
  if (typeof raw === 'number') {
    const iso = serialToIso(raw);
    return { iso, hijri: iso ? toHijri(iso) : null, invalid: iso === null };
  }
  const s = cleanText(raw);
  if (s === null) return { iso: null, hijri: null, invalid: false };
  const parts = parseYmd(s.replace(/\s+.*$/, ''));
  if (!parts) return { iso: null, hijri: null, invalid: true };
  const isHijri = parts.year < 1600;
  const iso = normalizeDateInput(s.replace(/\s+.*$/, ''), isHijri ? 'hijri' : 'gregorian');
  if (!iso) return { iso: null, hijri: null, invalid: true };
  const hijri = isHijri
    ? `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
    : toHijri(iso);
  return { iso, hijri, invalid: false };
}

function convert(def: FieldDef, raw: unknown, out: NormalizedRecord, warn: (m: string) => void) {
  switch (def.type) {
    case 'text':
      out[def.field] = cleanText(raw);
      return;
    case 'id':
      out[def.field] = cleanId(raw);
      return;
    case 'cardNumber':
      out[def.field] = cleanCardNumber(raw);
      return;
    case 'money':
      out[def.field] = cleanNumber(raw) ?? 0;
      return;
    case 'int':
      out[def.field] = cleanInt(raw);
      return;
    case 'bool': {
      const b = cleanBool(raw);
      if (b === null && cleanText(raw) !== null) warn(`قيمة غير مفهومة في «${def.labelAr}»: ${String(raw)}`);
      out[def.field] = b ?? false;
      return;
    }
    case 'date':
    case 'hijriDate': {
      const r = readDate(raw);
      if (r.invalid) warn(`تاريخ غير صالح في «${def.labelAr}»: ${String(raw)}`);
      out[def.field] = r.iso;
      if (def.hijriField) out[def.hijriField] = r.hijri;
      return;
    }
  }
}

interface HeaderMatch {
  sheet: ExcelJS.Worksheet;
  rowNumber: number;
  template: TemplateDef;
  columns: Map<string, number>;
  ignored: string[];
  missingOptional: string[];
  score: number;
}

function matchHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number, template: TemplateDef): HeaderMatch | null {
  const row = sheet.getRow(rowNumber);
  const headers: { col: number; text: string; key: string }[] = [];
  const colCount = Math.max(sheet.actualColumnCount, row.cellCount);
  for (let c = 1; c <= colCount; c++) {
    const raw = cellValue(row.getCell(c));
    const text = cleanText(raw);
    if (text) headers.push({ col: c, text, key: headerKey(text) });
  }
  if (headers.length === 0) return null;
  const required = template.requiredHeaders.map(headerKey);
  if (!required.every((r) => headers.some((h) => h.key === r))) return null;

  const columns = new Map<string, number>();
  const used = new Set<number>();
  const missingOptional: string[] = [];
  for (const f of template.fields) {
    const aliases = f.headers.map(headerKey);
    const hit = headers.find((h) => !used.has(h.col) && aliases.includes(h.key));
    if (hit) {
      columns.set(f.field, hit.col);
      used.add(hit.col);
    } else if (!f.required) {
      missingOptional.push(f.headers[0]);
    } else {
      return null;
    }
  }
  const ignored = headers.filter((h) => !used.has(h.col)).map((h) => h.text);
  return { sheet, rowNumber, template, columns, ignored, missingOptional, score: columns.size / template.fields.length };
}

function findHeader(workbook: ExcelJS.Workbook, candidates: TemplateKey[]): HeaderMatch | null {
  let best: HeaderMatch | null = null;
  for (const sheet of workbook.worksheets) {
    if (sheet.state && sheet.state !== 'visible') continue;
    const last = Math.min(sheet.rowCount, HEADER_SCAN_ROWS);
    for (let r = 1; r <= last; r++) {
      for (const key of candidates) {
        const m = matchHeaderRow(sheet, r, TEMPLATES[key]);
        if (m && (!best || m.score > best.score)) best = m;
      }
    }
  }
  return best;
}

export async function loadWorkbook(buffer: ArrayBuffer | Uint8Array): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new ImportError('unreadable', 'تعذّرت قراءة الملف. ارفع ملف Excel بصيغة ‎.xlsx كما صُدّر من المنصة الحكومية.');
  }
  if (workbook.worksheets.length === 0) throw new ImportError('no_sheet', 'الملف لا يحتوي على أي ورقة عمل.');
  return workbook;
}

export function detectTemplate(workbook: ExcelJS.Workbook): TemplateKey | null {
  return findHeader(workbook, TEMPLATE_KEYS)?.template.key ?? null;
}

/**
 * Parses a government template from an in-memory workbook. Nothing touches the disk: the caller owns
 * the buffer and discards it once this returns.
 */
export async function parseTemplate(buffer: ArrayBuffer | Uint8Array, expected?: TemplateKey): Promise<ParseResult> {
  const workbook = await loadWorkbook(buffer);
  const match = findHeader(workbook, expected ? [expected] : TEMPLATE_KEYS);
  if (!match) {
    const other = expected ? findHeader(workbook, TEMPLATE_KEYS.filter((k) => k !== expected)) : null;
    if (other && expected) {
      throw new ImportError(
        'template_mismatch',
        `هذا الملف يبدو «${other.template.nameAr}» وليس «${TEMPLATES[expected].nameAr}».`,
        { detected: other.template.key },
      );
    }
    const required = expected ? TEMPLATES[expected].requiredHeaders : [];
    throw new ImportError(
      expected ? 'missing_columns' : 'unknown_template',
      expected
        ? `لم نجد الأعمدة الأساسية لقالب «${TEMPLATES[expected].nameAr}»: ${required.join('، ')}.`
        : 'لم نتعرف على هذا القالب. تأكد أنه أحد القوالب الحكومية الخمسة دون تعديل على أسماء الأعمدة.',
      { required },
    );
  }

  const { sheet, template, columns } = match;
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const byKey = new Map<string, ParsedRow>();
  const keyDef = template.fields.find((f) => f.field === template.keyField)!;

  const lastRow = sheet.rowCount;
  if (lastRow - match.rowNumber > MAX_ROWS) {
    throw new ImportError('too_large', `الملف يتجاوز الحد الأقصى (${MAX_ROWS} صف).`);
  }

  for (let r = match.rowNumber + 1; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const raw = new Map<string, unknown>();
    let hasAny = false;
    for (const [field, col] of columns) {
      const v = cellValue(row.getCell(col));
      raw.set(field, v);
      if (cleanText(v instanceof Date ? 'd' : v) !== null) hasAny = true;
    }
    if (!hasAny) continue; // blank filler rows and merged footer rows

    const values: NormalizedRecord = {};
    const rowWarnings: string[] = [];
    for (const def of template.fields) {
      if (!columns.has(def.field)) continue;
      convert(def, raw.get(def.field), values, (m) => rowWarnings.push(m));
    }

    const key = values[template.keyField];
    if (typeof key !== 'string' || !key) {
      errors.push({ row: r, message: `الصف ${r}: «${keyDef.labelAr}» فارغ؛ تم تجاهل الصف.` });
      continue;
    }
    const check = template.validateKey(key);
    if (!check.ok) {
      errors.push({ row: r, key, message: `الصف ${r}: ${check.error}` });
      continue;
    }
    if (check.warning) rowWarnings.push(check.warning);
    const missingRequired = template.fields.filter((f) => f.required && (values[f.field] === null || values[f.field] === ''));
    if (missingRequired.length) {
      errors.push({ row: r, key, message: `الصف ${r}: حقل مطلوب فارغ (${missingRequired.map((f) => f.labelAr).join('، ')}).` });
      continue;
    }

    postProcess(template.key, values, rowWarnings);

    const label = template.labelFields
      .map((f) => values[f])
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .join(' ') || key;

    for (const m of rowWarnings) warnings.push({ row: r, key, message: m });
    if (byKey.has(key)) warnings.push({ row: r, key, message: `«${keyDef.labelAr}» ${key} مكرر في الملف؛ اعتمدنا آخر صف.` });
    byKey.set(key, { rowNumber: r, key, label, values });
  }

  if (byKey.size === 0 && errors.length === 0) {
    throw new ImportError('empty', 'لا توجد سجلات في الملف بعد صف العناوين.');
  }

  return {
    template: template.key,
    sheetName: sheet.name,
    headerRow: match.rowNumber,
    matchedColumns: [...columns.keys()].map((f) => template.fields.find((d) => d.field === f)!.headers[0]),
    missingOptionalColumns: match.missingOptional,
    ignoredColumns: match.ignored,
    rows: [...byKey.values()],
    errors,
    warnings,
  };
}

function postProcess(template: TemplateKey, values: NormalizedRecord, warn: string[]) {
  if (template === 'residents') {
    const hijri = typeof values.iqamaExpiryHijri === 'string' ? values.iqamaExpiryHijri : null;
    if (!values.iqamaExpiry && hijri) {
      values.iqamaExpiry = normalizeDateInput(hijri, 'hijri');
    } else if (values.iqamaExpiry && !hijri) {
      values.iqamaExpiryHijri = toHijri(values.iqamaExpiry as string);
    } else if (values.iqamaExpiry && hijri) {
      const fromHijri = normalizeDateInput(hijri, 'hijri');
      if (fromHijri && fromHijri !== values.iqamaExpiry) {
        warn.push(`تاريخ انتهاء الإقامة الميلادي ${values.iqamaExpiry} لا يطابق الهجري ${hijri} (${fromHijri}).`);
      }
    }
  }
  if (template === 'gosi') {
    const nationality = typeof values.nationality === 'string' ? normalizeArabic(values.nationality) : '';
    const id = String(values.nationalId ?? '');
    values.isSaudi = nationality === normalizeArabic('السعودية') || nationality === 'saudi' || (nationality === '' && id.startsWith('1'));
  }
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string' && /date|expiry/i.test(k) && !/hijri/i.test(k) && !isValidIso(v)) values[k] = null as FieldValue;
  }
}
