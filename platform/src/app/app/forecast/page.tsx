import Link from 'next/link';
import { Settings } from 'lucide-react';
import { BarList } from '@/components/ui/bar-list';
import { Card, Notice, PageHead } from '@/components/ui/card';
import { ForecastTable } from '@/components/forecast/forecast-table';
import { Kpi } from '@/components/ui/kpi';
import { FEE_CATEGORIES, feesForecast } from '@/lib/analytics/forecast';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { f, fmtMoney, fmtNumber, getI18n } from '@/lib/i18n';
import { loadRulesInput } from '@/lib/rules/sync';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.forecast.title };
}

export default async function ForecastPage(props: PageProps<'/app/forecast'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const horizon = [30, 60, 90].includes(Number(sp.h)) ? Number(sp.h) : 90;
  const input = await loadRulesInput(s.tenant.id);
  const fc = feesForecast(input);
  const summary = fc.summaries.find((x) => x.days === horizon)!;
  const lines = fc.lines.filter((l) => (l.daysLeft ?? 0) <= horizon);
  return (
    <>
      <PageHead
        title={t.forecast.title}
        sub={t.forecast.subtitle}
        actions={
          can(s.role, 'settings:manage') ? (
            <Link href="/app/settings?tab=rules" className="ui-btn ui-btn--ghost">
              <Settings size={18} />
              {t.forecast.editFees}
            </Link>
          ) : null
        }
      />
      <div className="ui-seg" role="group" aria-label={t.forecast.horizon}>
        {[30, 60, 90].map((h) => (
          <Link key={h} href={`/app/forecast?h=${h}`} aria-pressed={h === horizon} className="inline-flex items-center" style={{ minHeight: 36, padding: '0 14px', borderRadius: 9, textDecoration: 'none', font: '600 13px/1 var(--font-sans)', background: h === horizon ? 'var(--inverse)' : 'transparent', color: h === horizon ? 'var(--on-inverse)' : 'var(--ink-2)' }}>
            {t.forecast[`days${h}` as 'days30']}
          </Link>
        ))}
      </div>
      <div className="kpi-grid">
        {fc.summaries.map((x) => (
          <Kpi key={x.days} label={`${t.forecast.total} — ${t.forecast[`days${x.days}` as 'days30']}`} value={fmtNumber(x.total)} foot={t.common.sar} />
        ))}
        <Kpi label={t.forecast.categories.gosi} value={fmtNumber(fc.gosiMonthly)} foot={`${t.common.sar} · ${t.common.perMonth}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card title={`${t.forecast.total} — ${t.forecast[`days${horizon}` as 'days30']}`} sub={t.forecast.feesNote}>
          <BarList
            items={FEE_CATEGORIES.map((c) => ({ name: `${t.forecast.categories[c]} (${c === 'gosi' ? f(t.forecast.months, { n: summary.byCategory.gosi.count }) : summary.byCategory[c].count})`, count: Math.round(summary.byCategory[c].amount) })).filter((x) => x.count > 0)}
            otherLabel={locale === 'ar' ? 'أخرى' : 'Other'}
            format={(n) => fmtMoney(n, locale)}
            max={8}
          />
          {fc.pendingNewDriverCards.count ? (
            <div className="mt-4">
              <Notice tone="amber">{f(t.forecast.newDriverCards, { n: fc.pendingNewDriverCards.count, amount: fmtMoney(fc.pendingNewDriverCards.amount, locale) })}</Notice>
            </div>
          ) : null}
        </Card>
        <Card title={t.forecast.lines} flat>
          <ForecastTable rows={lines} />
        </Card>
      </div>
    </>
  );
}
