import Link from 'next/link';
import { Settings, Wallet } from 'lucide-react';
import { Notice, PageHead } from '@/components/ui/card';
import { ForecastByPlatform } from '@/components/forecast/forecast-table';
import { Kpi } from '@/components/ui/kpi';
import { feesForecast, PLATFORMS, type PlatformKey } from '@/lib/analytics/forecast';
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
  const initial = PLATFORMS.includes(sp.p as PlatformKey) ? (sp.p as PlatformKey) : 'muqeem';
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
            <Link href="/app/settings?tab=rules" className="ui-btn ui-btn--outline">
              <Settings size={18} />
              {t.forecast.editFees}
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="ui-seg" role="group" aria-label={t.forecast.horizon}>
          {[30, 60, 90].map((h) => (
            <Link key={h} href={`/app/forecast?h=${h}&p=${initial}`} aria-pressed={h === horizon} className="ui-seg__link">
              {t.forecast[`days${h}` as 'days30']}
            </Link>
          ))}
        </div>
        <span className="text-sm text-muted">{t.forecast.feesNote}</span>
      </div>
      <div className="kpi-grid kpi-grid--3">
        {fc.summaries.map((x) => (
          <Kpi key={x.days} color={x.days === horizon ? 'blue' : 'indigo'} icon={<Wallet size={17} />} label={`${t.forecast.grandTotal} — ${t.forecast[`days${x.days}` as 'days30']}`} value={fmtNumber(x.total)} foot={t.common.sar} href={`/app/forecast?h=${x.days}&p=${initial}`} />
        ))}
      </div>
      <ForecastByPlatform summary={summary} lines={lines} gosiEmployees={fc.gosiEmployees} initial={initial} />
      {fc.pendingNewDriverCards.count ? <Notice tone="amber">{f(t.forecast.newDriverCards, { n: fc.pendingNewDriverCards.count, amount: fmtMoney(fc.pendingNewDriverCards.amount, locale) })}</Notice> : null}
    </>
  );
}
