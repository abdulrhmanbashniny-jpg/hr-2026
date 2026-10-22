import { and, desc, eq, gte, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { cities, craftsmen, dealers, invoices } from '@/db/schema';

export type QueueStatus = 'pending' | 'flagged' | 'approved' | 'rejected' | 'processing';

export async function reviewQueue(opts: { status?: QueueStatus[]; minRisk?: number; craftsmanId?: string; limit?: number }) {
  const where: SQL[] = [inArray(invoices.status, opts.status?.length ? opts.status : ['pending', 'flagged'])];
  if (opts.minRisk) where.push(gte(invoices.riskScore, opts.minRisk));
  if (opts.craftsmanId) where.push(eq(invoices.craftsmanId, opts.craftsmanId));
  return db
    .select({
      inv: invoices,
      craftsman: { id: craftsmen.id, name: craftsmen.displayName, code: craftsmen.referralCode, tier: craftsmen.tier },
      dealer: { id: dealers.id, name: dealers.name },
      cityAr: cities.nameAr,
      cityEn: cities.nameEn,
    })
    .from(invoices)
    .innerJoin(craftsmen, eq(craftsmen.id, invoices.craftsmanId))
    .leftJoin(dealers, eq(dealers.id, invoices.dealerId))
    .leftJoin(cities, eq(cities.id, invoices.cityId))
    .where(and(...where))
    .orderBy(desc(invoices.riskScore), desc(invoices.createdAt))
    .limit(opts.limit ?? 100);
}
