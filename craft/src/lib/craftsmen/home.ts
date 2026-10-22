import { and, asc, count, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { craftsmen, pointsLedger, redemptions, referrals, rewards, users } from '@/db/schema';
import { referralNetwork } from '@/lib/referrals/service';
import { tierAllows } from '@/lib/rewards/service';
import type { Tier } from '@/lib/incentives/engine';

/** The extra figures the dashboard shows next to dashboard(): referrals, rewards received, a reward preview. */
export async function homeExtras(craftsmanId: string, tier: Tier, balance: number) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [network, [month], redeemed, catalogue, bonusByReferral, [user]] = await Promise.all([
    referralNetwork(craftsmanId),
    db.select({ n: count() }).from(referrals).where(and(eq(referrals.referrerId, craftsmanId), gt(referrals.createdAt, monthStart))),
    db.select({ status: redemptions.status, n: count() }).from(redemptions).where(eq(redemptions.craftsmanId, craftsmanId)).groupBy(redemptions.status),
    db
      .select()
      .from(rewards)
      .where(and(eq(rewards.isActive, true), or(isNull(rewards.stock), gt(rewards.stock, 0))))
      .orderBy(asc(rewards.pointsCost)),
    db
      .select({ refId: pointsLedger.refId, points: sql<number>`sum(${pointsLedger.delta})`.mapWith(Number) })
      .from(pointsLedger)
      .where(and(eq(pointsLedger.craftsmanId, craftsmanId), eq(pointsLedger.kind, 'referral_bonus')))
      .groupBy(pointsLedger.refId),
    db.select({ phone: users.phone }).from(craftsmen).innerJoin(users, eq(users.id, craftsmen.userId)).where(eq(craftsmen.id, craftsmanId)),
  ]);
  const byStatus = Object.fromEntries(redeemed.map((r) => [r.status, r.n])) as Record<string, number>;
  const bonus = new Map(bonusByReferral.map((b) => [b.refId, b.points]));
  // Preview: what they can redeem now first, then the closest ones they are working towards.
  const eligible = catalogue.filter((r) => tierAllows(tier, r.minTier));
  const affordable = eligible.filter((r) => r.pointsCost <= balance).sort((a, b) => b.pointsCost - a.pointsCost);
  const upcoming = eligible.filter((r) => r.pointsCost > balance);
  const locked = catalogue.filter((r) => !tierAllows(tier, r.minTier));
  const preview = [...affordable.slice(0, 2), ...upcoming, ...locked].slice(0, 3);
  return {
    phone: user?.phone ?? null,
    referrals: {
      total: network.level1.length,
      thisMonth: month.n,
      confirmed: network.activeCount,
      recent: network.level1.slice(0, 5).map((r) => ({ ...r, bonus: bonus.get(r.id) ?? null })),
      earned: network.earned,
    },
    rewardsReceived: byStatus.fulfilled ?? 0,
    rewardsInProgress: byStatus.requested ?? 0,
    preview: preview.map((r) => ({ ...r, tierAllowed: tierAllows(tier, r.minTier), affordable: r.pointsCost <= balance })),
  };
}
