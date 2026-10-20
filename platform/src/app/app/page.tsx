import { and, desc, eq } from 'drizzle-orm';
import { BellRing, Car, IdCard, ShieldCheck, Upload, Wallet } from 'lucide-react';
import Link from 'next/link';
import { AlertList, sortAlerts } from '@/components/app/alert-list';
import { BarList } from '@/components/ui/bar-list';
import { Card, PageHead } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { ExpiryMatrix } from '@/components/ui/matrix';
import { db } from '@/db';
import { complianceAlerts, importBatches } from '@/db/schema';
import { matrixOf } from '@/lib/analytics/common';
import { fleetAnalytics } from '@/lib/analytics/fleet';
import { feesForecast } from '@/lib/analytics/forecast';
import { gosiAnalytics } from '@/lib/analytics/gosi';
import { residentAnalytics } from '@/lib/analytics/residents';
import { requireTenant } from '@/lib/auth/guards';
import { f, fmtDate, fmtMoney, fmtNumber, getI18n } from '@/lib/i18n';
import { TEMPLATE_KEYS } from '@/lib/imports/types';
import { TEMPLATES } from '@/lib/imports/templates';
import { loadRulesInput } from '@/lib/rules/sync';

export default async function DashboardPage() {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const input = await loadRulesInput(s.tenant.id);
  const { today, settings } = input;
  const [open, batches] = await Promise.all([
    db.select().from(complianceAlerts).where(and(eq(complianceAlerts.tenantId, s.tenant.id), eq(complianceAlerts.status, 'open'))),
    db.select().from(importBatches).where(eq(importBatches.tenantId, s.tenant.id)).orderBy(desc(importBatches.createdAt)).limit(50),
  ]);
  const res = residentAnalytics(input.residents, today, settings);
  const gosi = gosiAnalytics(input.gosi, today, settings);
  const fleet = fleetAnalytics(input.vehicles, input.operatingCards, today, settings);
  const fees = feesForecast(input);
  const critical = sortAlerts(open.filter((a) => a.severity === 'critical'));
  const high = open.filter((a) => a.severity === 'high').length;
  const top = sortAlerts(open.filter((a) => a.severity !== 'info')).slice(0, 8);
  const lastBy = new Map<string, Date>();
  for (const b of batches) if (!lastBy.has(b.template)) lastBy.set(b.template, b.createdAt);
  const activeOp = input.operatingCards.filter((c) => c.recordStatus === 'active');
  const activeDrv = input.driverCards.filter((c) => c.recordStatus === 'active');
  const i = { size: 16 };
  const hasData = input.residents.length + input.gosi.length + input.vehicles.length + input.documents.length > 0;

  return (
    <>
      <PageHead title={t.dashboard.title} sub={f(t.dashboard.subtitle, { company: s.tenant.name })} />

      <div className="ui-alert-bar">
        <BellRing size={22} />
        <div className="min-w-[220px] flex-1">
          <b>{critical.length ? f(t.dashboard.urgentTitle, { n: critical.length }) : t.dashboard.allClear}</b>
          {critical[0] ? (
            <div className="text-sm" style={{ opacity: 0.85 }}>
              {f(t.dashboard.urgentSub, { first: `${locale === 'ar' ? critical[0].titleAr : critical[0].titleEn} — ${critical[0].entityLabel}` })}
            </div>
          ) : null}
        </div>
        <Link href="/app/alerts?severity=critical" className="ui-btn ui-btn--gold ui-btn--sm">
          {t.dashboard.viewAlerts}
        </Link>
      </div>

      <div className="kpi-grid">
        <Kpi icon={<IdCard {...i} />} label={t.dashboard.kpiResidents} value={fmtNumber(res.total)} foot={f(t.dashboard.kpiResidentsFoot, { n: res.byNationality.length, abroad: res.outsideKingdom })} />
        <Kpi icon={<ShieldCheck {...i} />} label={t.dashboard.kpiSaudization} value={`${fmtNumber(gosi.saudizationPct, 1)}%`} foot={f(t.dashboard.kpiSaudizationFoot, { saudis: gosi.saudis, total: gosi.total })} />
        <Kpi icon={<Car {...i} />} label={t.dashboard.kpiFleet} value={`${fmtNumber(fleet.readinessPct, 1)}%`} foot={f(t.dashboard.kpiFleetFoot, { ready: fleet.ready, total: fleet.total })} tone={fleet.readinessPct < 80 ? 'down' : undefined} />
        <Kpi icon={<BellRing {...i} />} label={t.dashboard.kpiAlerts} value={fmtNumber(open.length)} foot={f(t.dashboard.kpiAlertsFoot, { critical: critical.length, high })} />
        <Kpi icon={<Wallet {...i} />} label={t.dashboard.kpiFees} value={fmtNumber(fees.summaries[0].total)} foot={`${t.common.sar} · ${t.dashboard.kpiFeesFoot}`} />
      </div>

      {!hasData ? (
        <Card>
          <div className="ui-empty">
            <Upload />
            <p>{t.dashboard.empty}</p>
            <Link href="/app/imports" className="ui-btn ui-btn--primary">
              {t.nav.imports}
            </Link>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" aria-label={t.dashboard.matrices}>
        <ExpiryMatrix title={t.dashboard.iqama} matrix={res.iqamaMatrix} t={t} hrefFor={(b) => `/app/residents?bucket=${b}`} />
        <ExpiryMatrix title={t.dashboard.passport} matrix={res.passportMatrix} t={t} hrefFor={(b) => `/app/residents?passport=${b}`} />
        <ExpiryMatrix title={t.dashboard.documents} matrix={matrixOf(input.documents.map((d) => d.expiryDate), today)} t={t} hrefFor={(b) => `/app/documents?bucket=${b}`} />
        <ExpiryMatrix title={t.dashboard.license} matrix={fleet.licenseMatrix} t={t} hrefFor={(b) => `/app/fleet?license=${b}`} />
        <ExpiryMatrix title={t.dashboard.inspection} matrix={fleet.inspectionMatrix} t={t} hrefFor={(b) => `/app/fleet?inspection=${b}`} />
        <div className="grid gap-4">
          <ExpiryMatrix title={t.dashboard.opCards} matrix={matrixOf(activeOp.map((c) => c.expiryDate), today)} t={t} hrefFor={(b) => `/app/operating-cards?bucket=${b}`} />
          <ExpiryMatrix title={t.dashboard.driverCards} matrix={matrixOf(activeDrv.map((c) => c.expiryDate), today)} t={t} hrefFor={(b) => `/app/driver-cards?bucket=${b}`} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card
          title={t.dashboard.topAlerts}
          flat
          action={
            <Link href="/app/alerts" className="ui-btn ui-btn--ghost ui-btn--sm">
              {t.common.view}
            </Link>
          }
        >
          <AlertList alerts={top} t={t} locale={locale} />
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={t.dashboard.feesTitle}>
            <div className="flex flex-col gap-2">
              {fees.summaries.map((h) => (
                <div key={h.days} className="flex items-center justify-between">
                  <span className="text-muted">{t.forecast[`days${h.days}` as 'days30']}</span>
                  <b className="ui-num">{fmtMoney(h.total, locale)}</b>
                </div>
              ))}
              <Link href="/app/forecast" className="ui-btn ui-btn--ghost ui-btn--sm mt-2">
                {t.forecast.title}
              </Link>
            </div>
          </Card>
          <Card title={t.dashboard.nationalities}>
            <BarList items={res.byNationality} otherLabel={locale === 'ar' ? 'أخرى' : 'Other'} />
          </Card>
        </div>
      </div>

      <Card title={t.dashboard.quickUpload} sub={t.dashboard.quickUploadSub}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TEMPLATE_KEYS.map((k) => (
            <Link key={k} href={`/app/imports#${k}`} className="ui-file-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="ui-file-row__ext" data-ext="xlsx">
                XLSX
              </span>
              <span className="min-w-0">
                <b className="block truncate text-sm">{locale === 'ar' ? TEMPLATES[k].nameAr : TEMPLATES[k].nameEn}</b>
                <span className="text-xs text-muted">{lastBy.get(k) ? f(t.dashboard.lastImport, { date: fmtDate(lastBy.get(k)!, locale) }) : t.dashboard.neverImported}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
