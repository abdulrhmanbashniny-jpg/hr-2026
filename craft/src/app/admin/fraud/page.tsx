import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Network, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { craftsmen, fraudFlags, referrals } from '@/db/schema';
import { rejectReferralAction, releaseReferralAction, resolveFlagAction } from '@/app/admin/actions';
import { ActionButton } from '@/components/admin/action-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { clusters } from '@/lib/admin/fraud';
import { requireStaffPage } from '@/lib/auth/guards';
import { staffCan } from '@/lib/auth/roles';
import { f, fmtRelative, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function FraudPage() {
  const s = await requireStaffPage('fraud:view');
  const { t, locale } = await getI18n();
  const c = consoleDictionary(locale);
  const canManage = staffCan(s.user.role, 'fraud:manage');
  const referrer = alias(craftsmen, 'referrer');
  const referee = alias(craftsmen, 'referee');
  const [groups, flags, held] = await Promise.all([
    clusters(),
    db
      .select({ f: fraudFlags, name: craftsmen.displayName, code: craftsmen.referralCode })
      .from(fraudFlags)
      .leftJoin(craftsmen, eq(craftsmen.id, fraudFlags.craftsmanId))
      .where(and(eq(fraudFlags.status, 'open')))
      .orderBy(desc(fraudFlags.score), desc(fraudFlags.createdAt))
      .limit(100),
    db
      .select({ r: referrals, from: referrer.displayName, fromId: referrer.id, to: referee.displayName, toId: referee.id })
      .from(referrals)
      .innerJoin(referrer, eq(referrer.id, referrals.referrerId))
      .innerJoin(referee, eq(referee.id, referrals.refereeId))
      .where(eq(referrals.status, 'held'))
      .orderBy(desc(referrals.createdAt)),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.fraud.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.fraud.subtitle}</p>
      </div>

      <Card>
        <CardHeader title={c.fraud.clusters} />
        {groups.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-6" />} title={c.fraud.noClusters} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {groups.map((g) => (
              <div key={`${g.kind}:${g.key}`} className="rounded-2xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {g.kind === 'device' ? <Smartphone className="size-4 text-danger" /> : <Network className="size-4 text-warning" />}
                    {g.kind === 'device' ? c.fraud.device : c.fraud.network}
                  </span>
                  <Badge tone={g.kind === 'device' ? 'danger' : 'warning'}>{f(c.fraud.accounts, { n: g.accounts })}</Badge>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {g.craftsmen.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/craftsmen/${m.id}`} className="truncate text-ink-2 hover:underline">
                        {m.name}
                      </Link>
                      <span className="num text-xs text-muted">{m.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title={c.fraud.held} />
        {held.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <ul className="divide-y divide-line">
            {held.map((h) => (
              <li key={h.r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-ink">
                    <Link href={`/admin/craftsmen/${h.fromId}`} className="hover:underline">
                      {h.from}
                    </Link>{' '}
                    ←{' '}
                    <Link href={`/admin/craftsmen/${h.toId}`} className="hover:underline">
                      {h.to}
                    </Link>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.r.riskReasons.map((x) => (
                      <Badge key={x.code} tone="warning">
                        {t.risk[x.code]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="num text-xs text-muted">
                  {c.fraud.score} {h.r.riskScore}
                </span>
                {canManage && (
                  <>
                    <ActionButton action={releaseReferralAction.bind(null, h.r.id)} variant="secondary">
                      {c.fraud.release}
                    </ActionButton>
                    <ActionButton action={rejectReferralAction.bind(null, h.r.id)} variant="danger">
                      {c.fraud.rejectReferral}
                    </ActionButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title={c.fraud.flags} subtitle={canManage ? c.fraud.confirmHint : undefined} />
        {flags.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-6" />} title={c.fraud.noFlags} />
        ) : (
          <ul className="divide-y divide-line">
            {flags.map(({ f: fl, name, code }) => (
              <li key={fl.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Badge tone={fl.score >= 80 ? 'danger' : 'warning'}>
                  <span className="num">{fl.score}</span>
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-ink">
                    {c.fraud.subjects[fl.subjectType]} · {t.risk[fl.rule as keyof typeof t.risk] ?? fl.rule}
                  </div>
                  <div className="text-xs text-muted">
                    {name ? `${name} · ` : ''}
                    <span className="num">{code}</span> · {fmtRelative(fl.createdAt, locale)}
                  </div>
                </div>
                {canManage && (
                  <>
                    <ActionButton action={resolveFlagAction.bind(null, fl.id, 'dismissed')} variant="ghost">
                      {c.fraud.dismiss}
                    </ActionButton>
                    <ActionButton action={resolveFlagAction.bind(null, fl.id, 'confirmed')} variant="danger" confirm={c.fraud.confirmHint}>
                      {c.fraud.confirm}
                    </ActionButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
