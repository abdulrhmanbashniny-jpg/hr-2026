import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getEconomics } from '@/lib/settings/store';

const num = (v: unknown) => Number(v ?? 0);

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/**
 * The figures of the console dashboard for a period (7, 30 or 90 days) compared with the period
 * before it, plus six months of sign-ups and confirmed referrals, the tier split and the cities.
 */
export async function consoleOverview(days: Period) {
  const eco = await getEconomics();
  const window = sql.raw(`interval '${days} days'`);
  const [k] = (
    await db.execute(sql`
    select
      (select count(*) from craftsmen) as craftsmen,
      (select count(*) from craftsmen where created_at > now() - ${window}) as new_now,
      (select count(*) from craftsmen where created_at > now() - 2 * ${window} and created_at <= now() - ${window}) as new_before,
      (select count(*) from referrals) as referrals,
      (select count(*) from referrals where created_at > now() - ${window}) as referrals_now,
      (select count(*) from referrals where status = 'activated') as confirmed,
      (select count(*) from referrals where status in ('pending','held')) as referrals_open,
      (select coalesce(-sum(delta),0) from points_ledger where kind = 'redemption' and created_at > now() - ${window}) as redeemed_points,
      (select coalesce(sum(value_sar),0) from redemptions r join rewards w on w.id = r.reward_id where r.status = 'fulfilled' and r.fulfilled_at > now() - ${window}) as paid_sar,
      (select count(*) from invoices where status in ('pending','flagged')) as queue,
      (select count(*) from invoices where status = 'pending') as pending,
      (select count(*) from invoices where status = 'approved') as approved,
      (select count(*) from invoices where status = 'rejected') as rejected
  `)
  ).rows as Record<string, unknown>[];

  const months = (
    await db.execute(sql`
    select to_char(m, 'YYYY-MM') as month,
      (select count(*) from craftsmen c where c.created_at >= m and c.created_at < m + interval '1 month') as signups,
      (select count(*) from referrals r where r.status = 'activated' and r.activated_at >= m and r.activated_at < m + interval '1 month') as confirmed
    from generate_series(date_trunc('month', now() at time zone 'Asia/Riyadh') - interval '5 months', date_trunc('month', now() at time zone 'Asia/Riyadh'), interval '1 month') m
    order by m
  `)
  ).rows as Record<string, unknown>[];

  const tiers = (await db.execute(sql`select tier, count(*)::int as n from craftsmen group by tier`)).rows as { tier: 'A' | 'B' | 'C'; n: number }[];

  const cities = (
    await db.execute(sql`
    select ci.id, ci.name_ar, ci.name_en, ci.lat, ci.lng, ci.region_code,
      count(c.id)::int as craftsmen,
      count(c.id) filter (where c.activated_at is not null)::int as active,
      count(c.id) filter (where c.created_at > now() - ${window})::int as new_now,
      (select count(*) from invoices i where i.city_id = ci.id and i.status = 'approved')::int as invoices
    from cities ci left join craftsmen c on c.city_id = ci.id
    group by ci.id order by count(c.id) desc
  `)
  ).rows as { id: string; name_ar: string; name_en: string; lat: number; lng: number; region_code: string; craftsmen: number; active: number; new_now: number; invoices: number }[];

  const regions = (
    await db.execute(sql`
    select r.code, r.name_ar, r.name_en, count(c.id)::int as craftsmen,
      (select count(*) from referrals x join craftsmen y on y.id = x.referee_id join cities z on z.id = y.city_id where z.region_code = r.code and x.created_at > now() - ${window})::int as referrals_now
    from regions r left join cities ci on ci.region_code = r.code left join craftsmen c on c.city_id = ci.id
    group by r.code order by count(c.id) desc
  `)
  ).rows as { code: string; name_ar: string; name_en: string; craftsmen: number; referrals_now: number }[];

  const signups = months.map((m) => num(m.signups));
  const last = signups.at(-1) ?? 0;
  const prev = signups.at(-2) ?? 0;
  return {
    days,
    pointValueSar: eco.pointValueSar,
    kpis: {
      craftsmen: num(k.craftsmen),
      newNow: num(k.new_now),
      newBefore: num(k.new_before),
      referrals: num(k.referrals),
      referralsNow: num(k.referrals_now),
      confirmed: num(k.confirmed),
      referralsOpen: num(k.referrals_open),
      redeemedPoints: num(k.redeemed_points),
      paidSar: num(k.paid_sar),
      queue: num(k.queue),
    },
    invoiceTabs: { all: num(k.pending) + num(k.approved) + num(k.rejected), pending: num(k.pending), approved: num(k.approved), rejected: num(k.rejected) },
    months: months.map((m) => ({ month: String(m.month), signups: num(m.signups), confirmed: num(m.confirmed) })),
    monthlyGrowth: prev ? (last - prev) / prev : null,
    tiers: { A: tiers.find((t) => t.tier === 'A')?.n ?? 0, B: tiers.find((t) => t.tier === 'B')?.n ?? 0, C: tiers.find((t) => t.tier === 'C')?.n ?? 0 },
    cities,
    regions,
  };
}
