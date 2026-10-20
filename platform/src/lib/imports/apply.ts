import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { driverCards, gosiSubscribers, importBatches, operatingCards, residents, vehicles } from '@/db/schema';
import { decideRow, isFileStale } from './diff';
import { TEMPLATES } from './templates';
import type { ImportReport, NormalizedRecord, ParseResult, TemplateKey } from './types';

export const TEMPLATE_TABLES = {
  residents,
  gosi: gosiSubscribers,
  vehicles,
  operating_cards: operatingCards,
  driver_cards: driverCards,
} as const;

/** All template tables share the lifecycle columns; this view is used for the generic upsert. */
type GenericTable = typeof residents;
type GenericRow = Record<string, unknown> & {
  id: string;
  recordStatus: 'active' | 'missing' | 'archived';
};

const REPORT_LIST_CAP = 1000;
const INSERT_CHUNK = 500;

function cap<T>(list: T[]): T[] {
  return list.length > REPORT_LIST_CAP ? list.slice(0, REPORT_LIST_CAP) : list;
}

export interface ApplyResult {
  batchId: string;
  report: ImportReport;
}

export async function applyImport(input: {
  tenantId: string;
  userId: string | null;
  fileName: string;
  fileSize: number;
  parsed: ParseResult;
  fileDiscardedAt: Date;
}): Promise<ApplyResult> {
  const { tenantId, parsed } = input;
  const template = TEMPLATES[parsed.template];
  const table = TEMPLATE_TABLES[parsed.template] as unknown as GenericTable;
  const keyField = template.keyField as keyof GenericRow;

  const existingRows = (await db.select().from(table).where(eq(table.tenantId, tenantId))) as unknown as GenericRow[];
  const existing = new Map(existingRows.map((r) => [String(r[keyField]), r]));
  const batchId = randomUUID();

  const report: ImportReport = {
    template: parsed.template,
    sheetName: parsed.sheetName,
    headerRow: parsed.headerRow,
    matchedColumns: parsed.matchedColumns,
    missingOptionalColumns: parsed.missingOptionalColumns,
    ignoredColumns: parsed.ignoredColumns,
    rows: parsed.rows.length,
    created: [],
    updated: [],
    stale: [],
    conflicts: [],
    missing: [],
    errors: parsed.errors,
    warnings: parsed.warnings,
    fileIsStale: false,
    missingDetectionSkipped: false,
  };

  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; set: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  let unchanged = 0;
  const now = new Date();

  for (const row of parsed.rows) {
    seen.add(row.key);
    const current = existing.get(row.key);
    if (!current) {
      inserts.push({ ...row.values, tenantId, lastImportId: batchId, recordStatus: 'active' });
      report.created.push({ key: row.key, label: row.label });
      continue;
    }
    const restored = current.recordStatus !== 'active';
    const lifecycle: Record<string, unknown> = { lastImportId: batchId, updatedAt: now };
    if (restored) Object.assign(lifecycle, { recordStatus: 'active', missingSince: null, archivedAt: null, archiveReason: null });

    const decision = decideRow(template, row.values, current as unknown as NormalizedRecord);
    switch (decision.kind) {
      case 'unchanged':
        unchanged++;
        updates.push({ id: current.id, set: lifecycle });
        if (restored) report.updated.push({ key: row.key, label: row.label, fields: [], restored: true });
        break;
      case 'updated':
        updates.push({ id: current.id, set: { ...decision.patch, ...lifecycle } });
        report.updated.push({ key: row.key, label: row.label, fields: decision.fields, restored: restored || undefined });
        break;
      case 'stale':
        updates.push({ id: current.id, set: lifecycle });
        report.stale.push({ key: row.key, label: row.label, dates: decision.older });
        break;
      case 'conflict':
        updates.push({ id: current.id, set: { ...decision.patch, ...lifecycle } });
        report.conflicts.push({ key: row.key, label: row.label, applied: decision.fields, kept: decision.kept });
        break;
    }
  }

  const matched = parsed.rows.length - report.created.length;
  report.fileIsStale = isFileStale({ matched, stale: report.stale.length, conflicts: report.conflicts.length });

  const missingIds: string[] = [];
  if (report.fileIsStale) {
    report.missingDetectionSkipped = true;
  } else {
    for (const row of existingRows) {
      const key = String(row[keyField]);
      if (row.recordStatus === 'active' && !seen.has(key)) {
        missingIds.push(row.id);
        const label = template.labelFields.map((f) => row[f]).filter(Boolean).join(' ') || key;
        report.missing.push({ key, label });
      }
    }
  }

  const finalReport: ImportReport = {
    ...report,
    created: cap(report.created),
    updated: cap(report.updated),
    stale: cap(report.stale),
    conflicts: cap(report.conflicts),
    missing: cap(report.missing),
    errors: cap(report.errors),
    warnings: cap(report.warnings),
  };

  await db.transaction(async (tx) => {
    await tx.insert(importBatches).values({
      id: batchId,
      tenantId,
      template: parsed.template,
      fileName: input.fileName.slice(0, 255),
      fileSize: input.fileSize,
      rowCount: parsed.rows.length,
      createdCount: report.created.length,
      updatedCount: report.updated.length,
      unchangedCount: unchanged,
      staleCount: report.stale.length,
      conflictCount: report.conflicts.length,
      missingCount: report.missing.length,
      errorCount: report.errors.length,
      fileIsStale: report.fileIsStale,
      report: finalReport,
      userId: input.userId,
      fileDiscardedAt: input.fileDiscardedAt,
    });
    for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
      await tx.insert(table).values(inserts.slice(i, i + INSERT_CHUNK) as (typeof table.$inferInsert)[]);
    }
    for (const u of updates) {
      await tx.update(table).set(u.set as Partial<typeof table.$inferInsert>).where(eq(table.id, u.id));
    }
    if (missingIds.length) {
      await tx
        .update(table)
        .set({ recordStatus: 'missing', missingSince: now, updatedAt: now })
        .where(inArray(table.id, missingIds));
    }
  });

  return { batchId, report: finalReport };
}

export const TEMPLATE_ORDER: TemplateKey[] = ['residents', 'gosi', 'vehicles', 'operating_cards', 'driver_cards'];
