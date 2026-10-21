import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getEconomics } from '@/lib/settings/store';

const num = (v: unknown) => Number(v ?? 0);

/** Console overview: programme health, money, risk and the last 30 days, in a handful of aggregate queries. */
export async function overview() {
  const eco = await getEconomics();
  const [k] = (
    await db.execute(sql`
    select
      (select count(*) from craftsmen) as craftsmen,
      (select count(*) from craftsmen where activated_at is not null) as activated,
      (select count(*) from craftsmen where created_at > now() - interval '30 days') as new30,
      (select count(*) from craftsmen where tier = 'A') as tier_a,
      (select count(*) from invoices where status in ('pending','flagged')) as queue,
      (select count(*) from invoices where status = 'flagged') as flagged,
      (select count(*) from invoices where status = 'approved' and reviewed_at > now() - interval '30 days') as approved30,
      (select coalesce(sum(total_amount),0) from invoices where status = 'approved' and reviewed_at > now() - interval '30 days') as gmv30,
      (select coalesce(sum(balance),0) from wallets) as outstanding,
      (select coalesce(sum(delta),0) from points_ledger where delta > 0 and created_at > now() - interval '30 days') as issued30,
      (select coalesce(-sum(delta),0) from points_ledger where kind = 'redemption' and created_at > now() - interval '30 days') as redeemed30,
      (select count(*) from redemptions where status = 'requested') as redemptions_open,
      (select count(*) from fraud_flags where status = 'open') as fraud_open,
      (select count(*) from verification_documents where status = 'pending') as docs_pending,
      (select count(*) from referrals where status = 'held') as referrals_held,
      (select count(*) from invoices where status = 'approved' and reviewed_by is null) as auto_approved,
      (select count(*) from invoices where status = 'approved') as approved_all
  `)
  ).rows as Record<string, unknown>[];

  const daily = (
    await db.execute(sql`
    select to_char(d, 'YYYY-MM-DD') as day,
      (select count(*) from invoices i where i.created_at >= d and i.created_at < d + interval '1 day') as invoices,
      (select count(*) from craftsmen c where c.created_at >= d and c.created_at < d + interval '1 day') as signups,
      (select coalesce(sum(delta),0) from points_ledger l where l.delta > 0 and l.kind <> 'redemption_refund' and l.created_at >= d and l.created_at < d + interval '1 day') as issued,
      (select coalesce(-sum(delta),0) from points_ledger l where l.kind = 'redemption' and l.created_at >= d and l.created_at < d + interval '1 day') as redeemed
    from generate_series(date_trunc('day', now() at time zone 'Asia/Riyadh') - interval '29 days', date_trunc('day', now() at time zone 'Asia/Riyadh'), interval '1 day') d
    order by d
  `)
  ).rows as Record<string, unknown>[];

  const cities = (
    await db.execute(sql`
    select ci.id, ci.name_ar, ci.name_en, ci.lat, ci.lng, ci.region_code,
      count(c.id)::int as craftsmen,
      count(c.id) filter (where c.activated_at is not null)::int as active,
      (select count(*) from invoices i where i.city_id = ci.id and i.status = 'approved')::int as invoices
    from cities ci left join craftsmen c on c.city_id = ci.id
    group by ci.id order by count(c.id) desc
  `)
  ).rows as { id: string; name_ar: string; name_en: string; lat: number; lng: number; region_code: string; craftsmen: number; active: number; invoices: number }[];

  return {
    kpis: {
      craftsmen: num(k.craftsmen),
      activated: num(k.activated),
      new30: num(k.new30),
      tierA: num(k.tier_a),
      queue: num(k.queue),
      flagged: num(k.flagged),
      approved30: num(k.approved30),
      gmv30: num(k.gmv30),
      outstandingPoints: num(k.outstanding),
      liabilitySar: num(k.outstanding) * eco.pointValueSar,
      issued30: num(k.issued30),
      redeemed30: num(k.redeemed30),
      redemptionsOpen: num(k.redemptions_open),
      fraudOpen: num(k.fraud_open),
      docsPending: num(k.docs_pending),
      referralsHeld: num(k.referrals_held),
      autoApprovalRate: num(k.approved_all) ? num(k.auto_approved) / num(k.approved_all) : 0,
    },
    daily: daily.map((d) => ({ day: String(d.day), invoices: num(d.invoices), signups: num(d.signups), issued: num(d.issued), redeemed: num(d.redeemed) })),
    cities,
    pointValueSar: eco.pointValueSar,
  };
}
