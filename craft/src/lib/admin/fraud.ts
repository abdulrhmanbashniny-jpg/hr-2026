import { sql } from 'drizzle-orm';
import { db } from '@/db';

export interface Cluster {
  kind: 'device' | 'network';
  key: string;
  accounts: number;
  craftsmen: { id: string; name: string; code: string; createdAt: string; status: string }[];
  lastSeen: string;
}

/**
 * Accounts that share a device (first-party cookie) or a network prefix within 7 days. Referral
 * rings and invoice farms show up here as groups, which single-account rules cannot see.
 */
export async function clusters(minAccounts = 2): Promise<Cluster[]> {
  const rows = await db.execute<{ kind: 'device' | 'network'; key: string; accounts: number; last_seen: string; members: Cluster['craftsmen'] }>(sql`
    with grouped as (
      select 'device'::text as kind, device_id as key, user_id, max(created_at) as seen
      from device_signals where device_id is not null group by device_id, user_id
      union all
      select 'network'::text, ip_prefix_hash, user_id, max(created_at)
      from device_signals where ip_prefix_hash is not null and created_at > now() - interval '7 days' group by ip_prefix_hash, user_id
    )
    select g.kind, g.key, count(distinct g.user_id)::int as accounts, max(g.seen) as last_seen,
      coalesce(json_agg(json_build_object('id', c.id, 'name', c.display_name, 'code', c.referral_code, 'createdAt', c.created_at, 'status', u.status)) filter (where c.id is not null), '[]') as members
    from grouped g
    join users u on u.id = g.user_id
    left join craftsmen c on c.user_id = g.user_id
    group by g.kind, g.key
    having count(distinct g.user_id) >= ${minAccounts}
    order by count(distinct g.user_id) desc, max(g.seen) desc
    limit 100
  `);
  return rows.rows.map((r) => ({ kind: r.kind, key: r.key.slice(0, 10), accounts: r.accounts, lastSeen: r.last_seen, craftsmen: r.members }));
}
