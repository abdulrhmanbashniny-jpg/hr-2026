import { ExportPanel } from '@/components/admin/export-panel';
import { StatTile } from '@/components/admin/stat-tile';
import { overview } from '@/lib/admin/stats';
import { requireStaffPage } from '@/lib/auth/guards';
import { f, fmtCompact, fmtMoneyCompact, fmtNumber, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function ReportsPage() {
  await requireStaffPage('reports:export');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const { kpis: k, pointValueSar } = await overview();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.reports.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.reports.subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={c.kpi.gmv30} value={fmtMoneyCompact(k.gmv30, locale)} />
        <StatTile label={c.kpi.issued30} value={fmtCompact(k.issued30)} />
        <StatTile label={c.kpi.redeemed30} value={fmtCompact(k.redeemed30)} />
        <StatTile label={c.kpi.liability} value={fmtMoneyCompact(k.liabilitySar, locale)} hint={f(c.kpi.liabilityHint, { points: fmtNumber(k.outstandingPoints), value: pointValueSar })} />
      </div>
      <ExportPanel />
    </div>
  );
}
