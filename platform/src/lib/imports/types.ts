export type TemplateKey = 'residents' | 'gosi' | 'vehicles' | 'operating_cards' | 'driver_cards';
export const TEMPLATE_KEYS: TemplateKey[] = ['residents', 'gosi', 'vehicles', 'operating_cards', 'driver_cards'];

export type FieldValue = string | number | boolean | null;
export type NormalizedRecord = Record<string, FieldValue>;

export interface ParsedRow {
  /** 1-based row number in the sheet, for error messages. */
  rowNumber: number;
  key: string;
  label: string;
  values: NormalizedRecord;
}

export interface RowIssue {
  row?: number;
  key?: string;
  message: string;
}

export interface ParseResult {
  template: TemplateKey;
  sheetName: string;
  headerRow: number;
  matchedColumns: string[];
  missingOptionalColumns: string[];
  ignoredColumns: string[];
  rows: ParsedRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
}

export interface DateChange {
  field: string;
  fileValue: string | null;
  currentValue: string | null;
}

export interface ImportReport {
  template: TemplateKey;
  sheetName: string;
  headerRow: number;
  matchedColumns: string[];
  missingOptionalColumns: string[];
  ignoredColumns: string[];
  rows: number;
  created: { key: string; label: string }[];
  updated: { key: string; label: string; fields: string[]; restored?: boolean }[];
  stale: { key: string; label: string; dates: DateChange[] }[];
  conflicts: { key: string; label: string; applied: string[]; kept: DateChange[] }[];
  missing: { key: string; label: string }[];
  errors: RowIssue[];
  warnings: RowIssue[];
  fileIsStale: boolean;
  missingDetectionSkipped: boolean;
}

export class ImportError extends Error {
  constructor(
    public readonly code: 'unreadable' | 'no_sheet' | 'unknown_template' | 'template_mismatch' | 'missing_columns' | 'empty' | 'too_large',
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
