import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cities, craftsmen, incentiveRules, leads, pointsLedger, referrals, rewards, wallets } from '@/db/schema';
import { resolveIncentive } from '@/lib/incentives/engine';
import { getEconomics } from '@/lib/settings/store';
import { trustScore } from '@/lib/trust';
import { tierAllows } from '@/lib/rewards/service';
import { nextReward } from '@/lib/rewards/progress';
import { craftsmanStats } from './service';

/** Everything the craftsman home screen shows, in one round of parallel queries. */
export async function dashboard(craftsmanId: string) {
  const [c] = await db.select({ c: craftsmen, city: cities }).from(craftsmen).innerJoin(cities, eq(cities.id, craftsmen.cityId)).where(eq(craftsmen.id, craftsmanId));
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const eco = await getEconomics();

  const [[wallet], ledger, leadRows, stats, catalog, [{ activeRefs }], rules] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.craftsmanId, craftsmanId)),
    db.select().from(pointsLedger).where(eq(pointsLedger.craftsmanId, craftsmanId)).orderBy(desc(pointsLedger.createdAt)).limit(8),
    db
      .select({ channel: leads.channel, n: count() })
      .from(leads)
      .where(and(eq(leads.craftsmanId, craftsmanId), gte(leads.createdAt, monthStart)))
      .groupBy(leads.channel),
    craftsmanStats(craftsmanId),
    db.select({ id: rewards.id, pointsCost: rewards.pointsCost, titleAr: rewards.titleAr, titleEn: rewards.titleEn, minTier: rewards.minTier }).from(rewards).where(eq(rewards.isActive, true)),
    db.select({ activeRefs: count() }).from(referrals).where(and(eq(referrals.referrerId, craftsmanId), eq(referrals.status, 'activated'))),
    db.select().from(incentiveRules).where(and(eq(incentiveRules.isActive, true), eq(incentiveRules.target, 'invoice'), gte(incentiveRules.endsAt, sql`now()`))),
  ]);

  const balance = wallet?.balance ?? 0;
  const campaign = resolveIncentive(rules, { target: 'invoice', cityId: c.c.cityId, regionCode: c.city.regionCode, at: new Date() }, eco.maxMultiplier);
  const campaignRule = rules.find((r) => campaign.appliedRuleIds.includes(r.id) && r.multiplier === campaign.multiplier) ?? rules.find((r) => campaign.appliedRuleIds.includes(r.id));
  const leadsBy = Object.fromEntries(leadRows.map((l) => [l.channel, l.n])) as Record<string, number>;

  return {
    craftsman: c.c,
    city: c.city,
    balance,
    lifetimeEarned: wallet?.lifetimeEarned ?? 0,
    pointValueSar: eco.pointValueSar,
    next: nextReward(balance, catalog.filter((r) => tierAllows(c.c.tier, r.minTier))),
    ledger,
    leads: { views: leadsBy.profile_view ?? 0, whatsapp: leadsBy.whatsapp ?? 0, calls: leadsBy.call ?? 0, estimates: leadsBy.estimate ?? 0 },
    activeReferrals: activeRefs,
    trust: trustScore({
      tier: c.c.tier,
      identityStatus: c.c.identityStatus,
      licenseStatus: c.c.licenseStatus,
      projects: stats.projects,
      fieldVerifiedProjects: stats.fieldVerified,
      approvedInvoices: stats.approvedInvoices,
      accountAgeDays: (Date.now() - c.c.createdAt.getTime()) / 86_400_000,
      yearsExperience: c.c.yearsExperience,
    }),
    campaign: campaign.appliedRuleIds.length && campaignRule ? { name: campaignRule.name, multiplier: campaign.multiplier, flatBonus: campaign.flatBonus, endsAt: campaignRule.endsAt } : null,
  };
}
