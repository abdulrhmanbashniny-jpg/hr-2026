import { asc, desc } from 'drizzle-orm';
import { db } from '@/db';
import { cities, incentiveRules, regions } from '@/db/schema';
import { toggleRuleAction } from '@/app/admin/actions';
import { ActionButton } from '@/components/admin/action-button';
import { IncentiveEditor } from '@/components/admin/incentive-editor';
import { Badge, type Tone } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { fmtDate, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';
import { getEconomics } from '@/lib/settings/store';

const TONE: Record<string, Tone> = { live: 'success', scheduled: 'info', ended: 'neutral', off: 'danger' };

export default async function IncentivesPage() {
  await requireStaffPage('incentives:manage');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const [rules, regionRows, cityRows, eco] = await Promise.all([
    db.select().from(incentiveRules).orderBy(desc(incentiveRules.endsAt)),
    db.select().from(regions).orderBy(asc(regions.nameEn)),
    db.select().from(cities).orderBy(asc(cities.nameEn)),
    getEconomics(),
  ]);
  const now = new Date();
  const state = (r: (typeof rules)[number]) => (!r.isActive ? 'off' : r.endsAt <= now ? 'ended' : r.startsAt > now ? 'scheduled' : 'live');
  const place = (r: (typeof rules)[number]) => {
    if (r.scope === 'city') {
      const x = cityRows.find((y) => y.id === r.cityId);
      return x ? (locale === 'ar' ? x.nameAr : x.nameEn) : '';
    }
    if (r.scope === 'region') {
      const x = regionRows.find((y) => y.code === r.regionCode);
      return x ? (locale === 'ar' ? x.nameAr : x.nameEn) : '';
    }
    return c.incentives.scopes.national;
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.incentives.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{c.incentives.subtitle}</p>
      </div>
      <IncentiveEditor regions={regionRows} cities={cityRows} rules={rules} eco={eco} />
      <Card>
        <CardHeader title={c.nav.incentives} />
        {rules.length === 0 ? (
          <EmptyState title={c.incentives.empty} />
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((r) => {
              const st = state(r);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <Badge tone={TONE[st]} dot={st === 'live'}>
                    {c.incentives.states[st]}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{r.name}</div>
                    <div className="text-xs text-muted">
                      {c.incentives.targets[r.target]} · {place(r)} · {fmtDate(r.startsAt, locale)} → {fmtDate(r.endsAt, locale)}
                    </div>
                  </div>
                  <span className="num text-ink">×{r.multiplier}</span>
                  {r.flatBonus > 0 && <span className="num text-ink">+{r.flatBonus}</span>}
                  <ActionButton action={toggleRuleAction.bind(null, r.id, !r.isActive)} variant="ghost">
                    {r.isActive ? c.incentives.toggleOff : c.incentives.toggleOn}
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
