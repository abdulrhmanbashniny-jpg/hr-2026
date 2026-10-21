import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { invoices } from '@/db/schema';

export function publicInvoice(i: typeof invoices.$inferSelect) {
  return {
    id: i.id,
    status: i.status,
    sellerName: i.sellerName,
    sellerVat: i.sellerVat,
    totalAmount: i.totalAmount,
    vatAmount: i.vatAmount,
    declaredAmount: i.declaredAmount,
    issuedAt: i.issuedAt,
    qrPhase: i.qrPhase,
    qrSignature: i.qrSignature,
    pointsAwarded: i.pointsAwarded,
    reasons: i.status === 'approved' ? [] : i.riskReasons.map((r) => r.code),
    reviewNote: i.status === 'rejected' ? i.reviewNote : null,
    createdAt: i.createdAt,
  };
}

export async function listInvoices(craftsmanId: string, cursor: string | null, limit = 30) {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.craftsmanId, craftsmanId), cursor ? lt(invoices.createdAt, new Date(cursor)) : undefined))
    .orderBy(desc(invoices.createdAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map(publicInvoice);
  return { items, nextCursor: rows.length > limit ? rows[limit - 1].createdAt.toISOString() : null };
}
