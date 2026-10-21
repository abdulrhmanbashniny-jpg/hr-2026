import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { cities, craftsmen, users } from '@/db/schema';

export const landingStats = unstable_cache(
  async () => {
    const [r] = (
      await db.execute(sql`
      select
        (select count(*) from craftsmen) as craftsmen,
        (select count(distinct city_id) from craftsmen) as cities,
        (select count(*) from invoices where status = 'approved') as invoices,
        (select coalesce(sum(delta), 0) from points_ledger where delta > 0) as points
    `)
    ).rows as Record<string, string>[];
    return { craftsmen: Number(r.craftsmen), cities: Number(r.cities), invoices: Number(r.invoices), points: Number(r.points) };
  },
  ['landing-stats'],
  { revalidate: 600 },
);

export const featuredCraftsmen = unstable_cache(
  async () =>
    db
      .select({
        code: craftsmen.referralCode,
        name: craftsmen.displayName,
        tier: craftsmen.tier,
        years: craftsmen.yearsExperience,
        identity: craftsmen.identityStatus,
        cityAr: cities.nameAr,
        cityEn: cities.nameEn,
        memberSince: craftsmen.createdAt,
        availability: craftsmen.availability,
      })
      .from(craftsmen)
      .innerJoin(users, eq(users.id, craftsmen.userId))
      .innerJoin(cities, eq(cities.id, craftsmen.cityId))
      .where(and(eq(users.status, 'active'), isNull(craftsmen.deletionRequestedAt)))
      .orderBy(sql`case ${craftsmen.tier} when 'A' then 0 when 'B' then 1 else 2 end`, desc(craftsmen.yearsExperience))
      .limit(6),
  ['featured-craftsmen'],
  { revalidate: 600 },
);
