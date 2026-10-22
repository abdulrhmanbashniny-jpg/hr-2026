import { and, asc, count, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { SITE_TAG } from '@/lib/cache-tags';
import { db } from '@/db';
import { craftsmen, redemptions, rewards, users } from '@/db/schema';
import { getPublicProfile, type PublicProfile } from '@/lib/craftsmen/public';
import { featuredCraftsmen } from '@/lib/craftsmen/featured';
import { getBrand, listActiveProducts, type BrandSettings, type Product } from '@/lib/products/service';
import { referralNetwork } from '@/lib/referrals/service';
import { getEconomics } from '@/lib/settings/store';

/** The seeded showcase member whose real card illustrates the landing page for visitors. */
export const SHOWCASE_CODE = '839218';

type RewardKind = (typeof rewards.$inferSelect)['kind'];

export interface RewardGroup {
  kind: RewardKind;
  items: number;
  minCost: number;
  minValue: number | null;
  maxValue: number | null;
  redeemed: number;
}

export interface LandingData {
  members: { total: number; verified: number };
  economics: { referralBonus: number; welcomeBonus: number; commissionL1Pct: number; commissionL2Pct: number };
  rewardGroups: RewardGroup[];
  rewardCount: number;
  products: Product[];
  brand: BrandSettings;
  card: { profile: PublicProfile; joined: number; active: number; earned: number; own: boolean } | null;
}

/** Active, non-deleted members and how many of them have a verified identity. */
const memberCounts = unstable_cache(
  async () => {
    const [row] = await db
      .select({ total: count(), verified: sql<number>`count(*) filter (where ${craftsmen.identityStatus} = 'verified')`.mapWith(Number) })
      .from(craftsmen)
      .innerJoin(users, eq(users.id, craftsmen.userId))
      .where(and(eq(users.status, 'active'), isNull(craftsmen.deletionRequestedAt)));
    return { total: row?.total ?? 0, verified: row?.verified ?? 0 };
  },
  ['landing-member-counts'],
  { revalidate: 300, tags: [SITE_TAG] },
);

/** Active rewards grouped by kind, with how often each kind has been requested. */
const rewardGroups = unstable_cache(
  async (): Promise<{ groups: RewardGroup[]; total: number }> => {
    const [items, demand] = await Promise.all([
      db
        .select({ kind: rewards.kind, pointsCost: rewards.pointsCost, valueSar: rewards.valueSar })
        .from(rewards)
        .where(and(eq(rewards.isActive, true), or(isNull(rewards.stock), gt(rewards.stock, 0))))
        .orderBy(asc(rewards.pointsCost)),
      db.select({ kind: rewards.kind, n: count() }).from(redemptions).innerJoin(rewards, eq(rewards.id, redemptions.rewardId)).groupBy(rewards.kind),
    ]);
    const byKind = new Map<RewardKind, RewardGroup>();
    for (const r of items) {
      const value = r.valueSar === null ? null : Number(r.valueSar);
      const g = byKind.get(r.kind) ?? { kind: r.kind, items: 0, minCost: r.pointsCost, minValue: null, maxValue: null, redeemed: 0 };
      g.items += 1;
      g.minCost = Math.min(g.minCost, r.pointsCost);
      if (value !== null) {
        g.minValue = g.minValue === null ? value : Math.min(g.minValue, value);
        g.maxValue = g.maxValue === null ? value : Math.max(g.maxValue, value);
      }
      byKind.set(r.kind, g);
    }
    for (const d of demand) {
      const g = byKind.get(d.kind);
      if (g) g.redeemed = d.n;
    }
    return { groups: [...byKind.values()], total: items.length };
  },
  ['landing-reward-groups'],
  { revalidate: 300, tags: [SITE_TAG] },
);

/** The card shown in the "smart card" section: the signed-in member's own, or the showcase member's. */
async function cardFor(ownCode: string | null) {
  let code = ownCode ?? SHOWCASE_CODE;
  let profile = await getPublicProfile(code).catch(() => null);
  if (!profile && !ownCode) {
    // Fallback for databases without the seeded showcase member: the first featured member.
    const first = (await featuredCraftsmen().catch(() => []))[0];
    if (first) {
      code = first.code;
      profile = await getPublicProfile(code).catch(() => null);
    }
  }
  if (!profile) return null;
  const network = await referralNetwork(profile.id);
  return {
    profile,
    joined: network.level1.length,
    active: network.activeCount,
    earned: network.earned.referralBonus + network.earned.commissionL1 + network.earned.commissionL2,
    own: !!ownCode,
  };
}

export async function landingData(ownCode: string | null): Promise<LandingData> {
  const [members, eco, groups, products, brand, card] = await Promise.all([
    memberCounts().catch(() => ({ total: 0, verified: 0 })),
    getEconomics(),
    rewardGroups().catch(() => ({ groups: [], total: 0 })),
    listActiveProducts().catch(() => [] as Product[]),
    getBrand(),
    cardFor(ownCode).catch(() => null),
  ]);
  return {
    members,
    economics: { referralBonus: eco.referralBonus, welcomeBonus: eco.welcomeBonus, commissionL1Pct: eco.commissionL1Pct, commissionL2Pct: eco.commissionL2Pct },
    rewardGroups: groups.groups,
    rewardCount: groups.total,
    // Featured products lead, then the factory's own order.
    products: [...products].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder),
    brand,
    card,
  };
}
