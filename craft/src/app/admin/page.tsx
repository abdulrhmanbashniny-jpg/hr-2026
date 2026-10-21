import { Activity, BadgeCheck, Banknote, Coins, Gift, Receipt, ShieldAlert, TrendingUp, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { BarList, KsaMap, TimeSeriesChart } from '@/components/admin/charts';
import { StatTile } from '@/components/admin/stat-tile';
import { Card, CardHeader } from '@/components/ui/card';
import { overview } from '@/lib/admin/stats';
import { requireStaffPage } from '@/lib/auth/guards';
import { f, fmtCompact, fmtMoneyCompact, fmtNumber, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export const dynamic = 'force-dynamic';

export default async function ConsoleOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requireStaffPage();
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const o = await overview();
  const k = o.kpis;
  const days = o.daily.map((d) => d.day);
  const name = (x: { name_ar: string; name_en: string }) => (locale === 'ar' ? x.name_ar : x.name_en);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.nav.overview}</h1>
        <p className="mt-1 text-sm text-muted">{c.charts.last30}</p>
      </div>
      {(await searchParams).denied && <div className="rounded-xl bg-warning-soft p-3 text-sm text-warning">{c.denied}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label={c.kpi.craftsmen} value={fmtNumber(k.craftsmen)} hint={`${fmtNumber(k.new30)} · ${c.kpi.new30}`} icon={<Users className="size-4" />} href="/admin/craftsmen" />
        <StatTile label={c.kpi.activated} value={fmtNumber(k.activated)} hint={`${Math.round((k.activated / Math.max(1, k.craftsmen)) * 100)}%`} icon={<Activity className="size-4" />} />
        <StatTile label={c.kpi.queue} value={fmtNumber(k.queue)} hint={`${fmtNumber(k.flagged)} ${c.kpi.flagged}`} icon={<Receipt className="size-4" />} href="/admin/invoices" tone={k.queue ? 'accent' : undefined} />
        <StatTile label={c.kpi.gmv30} value={fmtMoneyCompact(k.gmv30, locale)} hint={`${fmtNumber(k.approved30)} ✓`} icon={<TrendingUp className="size-4" />} />
        <StatTile label={c.kpi.liability} value={fmtMoneyCompact(k.liabilitySar, locale)} hint={f(c.kpi.liabilityHint, { points: fmtCompact(k.outstandingPoints), value: o.pointValueSar })} icon={<Banknote className="size-4" />} />
        <StatTile label={c.kpi.issued30} value={fmtCompact(k.issued30)} icon={<Coins className="size-4" />} />
        <StatTile label={c.kpi.redeemed30} value={fmtCompact(k.redeemed30)} icon={<Gift className="size-4" />} />
        <StatTile label={c.kpi.autoRate} value={`${Math.round(k.autoApprovalRate * 100)}%`} icon={<Zap className="size-4" />} />
        <StatTile label={c.kpi.fraudOpen} value={fmtNumber(k.fraudOpen + k.referralsHeld)} icon={<ShieldAlert className="size-4" />} href="/admin/fraud" tone={k.fraudOpen ? 'danger' : undefined} />
        <StatTile label={c.kpi.docsPending} value={fmtNumber(k.docsPending)} hint={`${fmtNumber(k.redemptionsOpen)} · ${c.kpi.redemptionsOpen}`} icon={<BadgeCheck className="size-4" />} href="/admin/verification" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={c.charts.invoices} subtitle={c.charts.last30} />
          <TimeSeriesChart days={days} series={[{ key: 'invoices', label: c.charts.invoices, color: 'var(--series-1)', values: o.daily.map((d) => d.invoices) }]} />
        </Card>
        <Card>
          <CardHeader title={c.charts.points} subtitle={c.charts.last30} />
          <TimeSeriesChart
            days={days}
            area={false}
            series={[
              { key: 'issued', label: c.charts.issued, color: 'var(--series-1)', values: o.daily.map((d) => d.issued) },
              { key: 'redeemed', label: c.charts.redeemed, color: 'var(--series-2)', values: o.daily.map((d) => d.redeemed) },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader
            title={c.map.title}
            subtitle={c.map.subtitle}
            action={
              <Link href="/admin/map" className="text-sm text-muted hover:text-ink">
                {c.nav.map}
              </Link>
            }
          />
          <KsaMap cities={o.cities.map((x) => ({ id: x.id, name: name(x), lat: x.lat, lng: x.lng, craftsmen: x.craftsmen, active: x.active, invoices: x.invoices }))} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={c.charts.cities} />
            <BarList rows={o.cities.slice(0, 8).map((x) => ({ label: name(x), value: x.craftsmen }))} />
          </Card>
          <Card>
            <CardHeader title={c.charts.signups} subtitle={c.charts.last30} />
            <TimeSeriesChart height={160} days={days} series={[{ key: 'signups', label: c.charts.signups, color: 'var(--series-1)', values: o.daily.map((d) => d.signups) }]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
