import ExcelJS from 'exceljs';
import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { cities, craftsmen, dealers, invoices, pointsLedger, redemptions, rewards } from '@/db/schema';

export type ExportType = 'invoices' | 'ledger' | 'redemptions' | 'craftsmen';

type Row = Record<string, string | number | null>;

async function rowsFor(type: ExportType, from?: Date, to?: Date): Promise<{ columns: string[]; rows: Row[] }> {
  const range = (col: Parameters<typeof gte>[0]) => [from ? gte(col, from) : undefined, to ? lte(col, to) : undefined].filter(Boolean) as SQL[];
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  switch (type) {
    case 'invoices': {
      const data = await db
        .select({ i: invoices, code: craftsmen.referralCode, name: craftsmen.displayName, dealer: dealers.name })
        .from(invoices)
        .innerJoin(craftsmen, eq(craftsmen.id, invoices.craftsmanId))
        .leftJoin(dealers, eq(dealers.id, invoices.dealerId))
        .where(and(...range(invoices.createdAt)))
        .orderBy(desc(invoices.createdAt));
      return {
        columns: ['id', 'created_at', 'status', 'member_code', 'craftsman', 'dealer', 'seller_vat', 'issued_at', 'total_sar', 'vat_sar', 'qr_phase', 'signature', 'risk', 'base_points', 'points', 'reviewed_at'],
        rows: data.map(({ i, code, name, dealer }) => ({
          id: i.id,
          created_at: iso(i.createdAt),
          status: i.status,
          member_code: code,
          craftsman: name,
          dealer,
          seller_vat: i.sellerVat,
          issued_at: iso(i.issuedAt),
          total_sar: i.totalAmount,
          vat_sar: i.vatAmount,
          qr_phase: i.qrPhase,
          signature: i.qrSignature,
          risk: i.riskScore,
          base_points: i.basePoints,
          points: i.pointsAwarded,
          reviewed_at: iso(i.reviewedAt),
        })),
      };
    }
    case 'ledger': {
      const data = await db
        .select({ l: pointsLedger, code: craftsmen.referralCode, name: craftsmen.displayName })
        .from(pointsLedger)
        .innerJoin(craftsmen, eq(craftsmen.id, pointsLedger.craftsmanId))
        .where(and(...range(pointsLedger.createdAt)))
        .orderBy(desc(pointsLedger.createdAt));
      return {
        columns: ['id', 'created_at', 'member_code', 'craftsman', 'kind', 'delta', 'balance_after', 'ref_type', 'ref_id', 'idempotency_key', 'note'],
        rows: data.map(({ l, code, name }) => ({
          id: l.id,
          created_at: iso(l.createdAt),
          member_code: code,
          craftsman: name,
          kind: l.kind,
          delta: l.delta,
          balance_after: l.balanceAfter,
          ref_type: l.refType,
          ref_id: l.refId,
          idempotency_key: l.idempotencyKey,
          note: l.note,
        })),
      };
    }
    case 'redemptions': {
      const data = await db
        .select({ r: redemptions, code: craftsmen.referralCode, name: craftsmen.displayName, reward: rewards.titleEn, value: rewards.valueSar })
        .from(redemptions)
        .innerJoin(craftsmen, eq(craftsmen.id, redemptions.craftsmanId))
        .innerJoin(rewards, eq(rewards.id, redemptions.rewardId))
        .where(and(...range(redemptions.createdAt)))
        .orderBy(desc(redemptions.createdAt));
      return {
        columns: ['id', 'created_at', 'status', 'member_code', 'craftsman', 'reward', 'value_sar', 'points', 'payout_handle', 'fulfilled_at'],
        rows: data.map(({ r, code, name, reward, value }) => ({
          id: r.id,
          created_at: iso(r.createdAt),
          status: r.status,
          member_code: code,
          craftsman: name,
          reward,
          value_sar: value,
          points: r.pointsSpent,
          payout_handle: r.payoutHandle,
          fulfilled_at: iso(r.fulfilledAt),
        })),
      };
    }
    case 'craftsmen': {
      const data = await db
        .select({ c: craftsmen, city: cities.nameEn })
        .from(craftsmen)
        .innerJoin(cities, eq(cities.id, craftsmen.cityId))
        .where(and(...range(craftsmen.createdAt)))
        .orderBy(desc(craftsmen.createdAt));
      return {
        columns: ['member_code', 'name', 'city', 'tier', 'identity', 'licence', 'years', 'activated_at', 'created_at'],
        rows: data.map(({ c, city }) => ({
          member_code: c.referralCode,
          name: c.displayName,
          city,
          tier: c.tier,
          identity: c.identityStatus,
          licence: c.licenseStatus,
          years: c.yearsExperience,
          activated_at: iso(c.activatedAt),
          created_at: iso(c.createdAt),
        })),
      };
    }
  }
}

/** Spreadsheet cells that start with these characters are treated as formulas by Excel; neutralise them. */
function safeCell(v: string | number | null): string | number | null {
  return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export async function buildExport(type: ExportType, format: 'xlsx' | 'csv', from?: Date, to?: Date): Promise<{ body: Uint8Array; mime: string; filename: string }> {
  const { columns, rows } = await rowsFor(type, from, to);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    const esc = (v: string | number | null) => {
      const s = v === null ? '' : String(safeCell(v));
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '﻿' + [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c] ?? null)).join(','))].join('\n');
    return { body: new TextEncoder().encode(csv), mime: 'text/csv; charset=utf-8', filename: `hirfa-${type}-${stamp}.csv` };
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Paint Masters';
  const ws = wb.addWorksheet(type, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(12, c.length + 4) }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102A43' } };
  for (const r of rows) ws.addRow(Object.fromEntries(columns.map((c) => [c, safeCell(r[c] ?? null)])));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  const buf = await wb.xlsx.writeBuffer();
  return { body: new Uint8Array(buf as ArrayBuffer), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `hirfa-${type}-${stamp}.xlsx` };
}
