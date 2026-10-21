import { CircleDollarSign, Network, UserPlus, Users } from 'lucide-react';
import { InvitePanel } from '@/components/app/invite-panel';
import { Avatar } from '@/components/ui/avatar';
import { Badge, type Tone } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { f, fmtDate, fmtNumber, getI18n } from '@/lib/i18n';
import { referralNetwork } from '@/lib/referrals/service';
import { getEconomics } from '@/lib/settings/store';

const TONE: Record<string, Tone> = { pending: 'info', activated: 'success', held: 'warning', rejected: 'danger' };

export default async function ReferralsPage() {
  const s = await requireCraftsmanPage('/app/referrals');
  const { t, locale } = await getI18n();
  const [net, eco] = await Promise.all([referralNetwork(s.craftsman.id), getEconomics()]);
  const earned = net.earned.referralBonus + net.earned.commissionL1 + net.earned.commissionL2;
  const how = [
    f(t.referrals.how[0], { bonus: eco.referralBonus }),
    f(t.referrals.how[1], { l1: eco.commissionL1Pct }),
    f(t.referrals.how[2], { l2: eco.commissionL2Pct }),
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t.referrals.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.referrals.subtitle}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <InvitePanel code={s.craftsman.referralCode} />
        </Card>
        <Card>
          <CardHeader title={t.referrals.howTitle} />
          <ol className="space-y-3">
            {how.map((h, i) => (
              <li key={h} className="flex items-start gap-3 text-sm text-ink-2">
                <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
                {h}
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted">{t.referrals.twoLevels}</p>
        </Card>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: t.referrals.stats.level1, value: net.level1.length },
          { icon: Network, label: t.referrals.stats.level2, value: net.level2Count },
          { icon: CircleDollarSign, label: t.referrals.stats.earned, value: earned },
        ].map((x) => (
          <div key={x.label} className="surface p-4">
            <x.icon className="size-5 text-muted" />
            <div className="num mt-2 text-2xl font-semibold text-ink">{fmtNumber(x.value)}</div>
            <div className="text-xs text-muted">{x.label}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title={t.referrals.stats.level1} />
        {net.level1.length === 0 ? (
          <EmptyState icon={<UserPlus className="size-6" />} title={t.referrals.empty} />
        ) : (
          <ul className="divide-y divide-line">
            {net.level1.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <Avatar name={r.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{r.name}</div>
                  <div className="text-xs text-muted">
                    {locale === 'ar' ? r.cityAr : r.cityEn} · {f(t.referrals.joined, { date: fmtDate(r.createdAt, locale) })}
                  </div>
                </div>
                <Badge tone={TONE[r.status]}>{t.referrals.statuses[r.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
