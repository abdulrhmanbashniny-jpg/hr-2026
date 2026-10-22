import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { cities, craftsmen, pointsLedger, referrals } from '@/db/schema';

/** The craftsman's network: direct referrals with status, the size of level 2, and what referrals earned. */
export async function referralNetwork(craftsmanId: string) {
  const referee = alias(craftsmen, 'referee');
  const level1 = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      createdAt: referrals.createdAt,
      activatedAt: referrals.activatedAt,
      refereeId: referee.id,
      name: referee.displayName,
      tier: referee.tier,
      cityAr: cities.nameAr,
      cityEn: cities.nameEn,
    })
    .from(referrals)
    .innerJoin(referee, eq(referee.id, referrals.refereeId))
    .innerJoin(cities, eq(cities.id, referee.cityId))
    .where(eq(referrals.referrerId, craftsmanId))
    .orderBy(desc(referrals.createdAt));

  const ids = level1.map((r) => r.refereeId);
  const [{ level2 }] = ids.length ? await db.select({ level2: count() }).from(referrals).where(inArray(referrals.referrerId, ids)) : [{ level2: 0 }];

  const earnings = await db
    .select({ kind: pointsLedger.kind, total: sql<number>`coalesce(sum(${pointsLedger.delta}), 0)`.mapWith(Number) })
    .from(pointsLedger)
    .where(and(eq(pointsLedger.craftsmanId, craftsmanId), inArray(pointsLedger.kind, ['referral_bonus', 'commission_l1', 'commission_l2'])))
    .groupBy(pointsLedger.kind);
  const byKind = Object.fromEntries(earnings.map((e) => [e.kind, e.total])) as Record<string, number>;

  return {
    level1,
    level2Count: level2,
    activeCount: level1.filter((r) => r.status === 'activated').length,
    earned: { referralBonus: byKind.referral_bonus ?? 0, commissionL1: byKind.commission_l1 ?? 0, commissionL2: byKind.commission_l2 ?? 0 },
  };
}
