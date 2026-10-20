'use client';

import { BadgeCheck, Building2, Car, FileText, IdCard, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { Empty, Money } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { expiryText } from '@/components/ui/expiry';
import type { FeeLine, HorizonSummary, PlatformKey } from '@/lib/analytics/forecast';
import { bucketForDays } from '@/lib/dates';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtNumber } from '@/lib/i18n/format';

export const PLATFORM_ICON: Record<PlatformKey, typeof IdCard> = { muqeem: IdCard, gosi: ShieldCheck, tamm: Car, operating_cards: Truck, driver_cards: BadgeCheck, documents: FileText };
export const PLATFORM_TILE: Record<PlatformKey, string> = { muqeem: 'var(--accent)', gosi: 'var(--green)', tamm: 'var(--saffron)', operating_cards: 'var(--accent-2)', driver_cards: 'var(--purple)', documents: 'var(--teal)' };

export interface GosiEmployeeVM {
  nationalId: string;
  name: string;
  isSaudi: boolean;
  wage: number;
  employer: number;
  employee: number;
  total: number;
}

function LinesTable({ rows, platform }: { rows: FeeLine[]; platform: PlatformKey }) {
  const { t, locale } = useI18n();
  const monthFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const columns: Column<FeeLine>[] = [
    {
      key: 'label',
      header: t.common.name,
      cell: (r) =>
        r.kind === 'bill' ? (
          <b>{f(t.forecast.gosiBill, { month: monthFmt.format(new Date(`${r.label}-01T00:00:00Z`)) })}</b>
        ) : (
          <Link href={r.link}>{r.label}</Link>
        ),
      sort: (r) => r.label,
      csv: (r) => r.label,
    },
    {
      key: 'kind',
      header: t.forecast.item,
      cell: (r) => <span className={`ui-pill ${r.kind === 'new' ? 'ui-pill--amber' : r.kind === 'bill' ? 'ui-pill--blue' : 'ui-pill--gray'}`}>{platform === 'tamm' ? t.forecast.categories[r.category] : t.forecast.kinds[r.kind]}</span>,
      sort: (r) => `${r.kind}${r.category}`,
      csv: (r) => `${r.kind}/${r.category}`,
    },
    {
      key: 'due',
      header: t.alerts.due,
      cell: (r) =>
        r.dueDate ? (
          <span className="flex flex-col gap-0.5">
            <span className="ui-expiry" data-bucket={bucketForDays(r.daysLeft)}>
              <span className="ui-expiry__dot" />
              {expiryText(r.daysLeft, t, locale)}
            </span>
            <span className="ui-num text-xs text-muted">{r.dueDate}</span>
          </span>
        ) : (
          <span className="ui-expiry" data-bucket="d30">
            <span className="ui-expiry__dot" />
            {t.forecast.dueNow}
          </span>
        ),
      sort: (r) => r.daysLeft,
      csv: (r) => r.dueDate,
    },
    {
      key: 'parts',
      header: t.forecast.breakdown,
      cell: (r) =>
        r.parts.length > 1 ? (
          <span className="text-xs text-muted">
            {r.parts.map((p) => `${t.forecast.parts[p.part]} ${fmtNumber(p.amount, 2)}`).join(' + ')}
          </span>
        ) : null,
      hideSm: true,
    },
    { key: 'amount', header: t.forecast.amount, cell: (r) => <b><Money value={r.amount} unit={t.common.sar} digits={2} /></b>, sort: (r) => r.amount, csv: (r) => r.amount },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(r) => `${r.category}:${r.key}`} search={(r) => r.label} exportName={`fees-${platform}`} pageSize={15} empty={<Empty>{t.forecast.noLines}</Empty>} />;
}

function GosiEmployeesTable({ rows }: { rows: GosiEmployeeVM[] }) {
  const { t } = useI18n();
  const columns: Column<GosiEmployeeVM>[] = [
    { key: 'name', header: t.common.name, cell: (r) => <Link href={`/app/people/${r.nationalId}`}>{r.name}</Link>, sort: (r) => r.name, csv: (r) => r.name },
    { key: 'wage', header: t.forecast.wage, cell: (r) => <Money value={r.wage} unit={t.common.sar} />, sort: (r) => r.wage, csv: (r) => r.wage, hideSm: true },
    { key: 'employer', header: t.forecast.parts.employer, cell: (r) => <Money value={r.employer} unit={t.common.sar} digits={2} />, sort: (r) => r.employer, csv: (r) => r.employer },
    { key: 'employee', header: t.forecast.parts.employee, cell: (r) => <Money value={r.employee} unit={t.common.sar} digits={2} />, sort: (r) => r.employee, csv: (r) => r.employee, hideSm: true },
    { key: 'total', header: t.common.total, cell: (r) => <b><Money value={r.total} unit={t.common.sar} digits={2} /></b>, sort: (r) => r.total, csv: (r) => r.total },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(r) => r.nationalId} search={(r) => `${r.name} ${r.nationalId}`} exportName="gosi-contributions" pageSize={10} />;
}

/** One card per platform with its total, then the chosen platform's itemised lines. */
export function ForecastByPlatform({ summary, lines, gosiEmployees, initial }: { summary: HorizonSummary; lines: FeeLine[]; gosiEmployees: GosiEmployeeVM[]; initial: PlatformKey }) {
  const { t } = useI18n();
  const [active, setActive] = useState<PlatformKey>(initial);
  const platforms = Object.keys(summary.byPlatform) as PlatformKey[];
  const sel = summary.byPlatform[active];
  return (
    <>
      <div className="grid-3">
        {platforms.map((p) => {
          const s = summary.byPlatform[p];
          const Icon = PLATFORM_ICON[p];
          return (
            <button
              key={p}
              type="button"
              className="ui-kpi text-start"
              style={{ ['--tile' as string]: PLATFORM_TILE[p], cursor: 'pointer', font: 'inherit', color: 'inherit', outline: p === active ? '2px solid var(--accent)' : undefined, outlineOffset: 2 } as CSSProperties}
              aria-pressed={p === active}
              onClick={() => setActive(p)}
            >
              <span className="ui-kpi__label">
                <span className="ui-kpi__icon">
                  <Icon size={17} />
                </span>
                {t.forecast.platforms[p]}
              </span>
              <span className="ui-kpi__value">{fmtNumber(s.amount)}</span>
              <span className="ui-kpi__foot">
                {t.common.sar} · {f(t.forecast.items, { n: s.count })}
                {s.overdue ? <b style={{ color: 'var(--red-ink)' }}> · {f(t.forecast.overdue, { n: s.overdue })}</b> : null}
              </span>
            </button>
          );
        })}
      </div>

      <section className="ui-card ui-card--flat" id="details">
        <div className="ui-card__head" style={{ flexWrap: 'wrap' }}>
          <div className="min-w-0">
            <h2 className="ui-card__title flex items-center gap-2">
              <Building2 size={17} style={{ color: PLATFORM_TILE[active] }} />
              {t.forecast.platforms[active]}
            </h2>
            <p className="ui-card__sub">{t.forecast.platformHint[active]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(sel.parts).map(([part, amount]) => (
              <span key={part} className="ui-pill ui-pill--gray">
                {t.forecast.parts[part as keyof typeof t.forecast.parts]} · <span className="ui-num">{fmtNumber(amount)}</span>
              </span>
            ))}
            <span className="ui-pill ui-pill--blue">
              {t.common.total} · <span className="ui-num">{fmtNumber(sel.amount)}</span> {t.common.sar}
            </span>
          </div>
        </div>
        <div className="ui-toolbar" style={{ borderBottom: 0, paddingBottom: 0 }}>
          <div className="ui-tabs" role="tablist" aria-label={t.forecast.details}>
            {platforms.map((p) => (
              <button key={p} type="button" role="tab" className="ui-tab" aria-selected={p === active} onClick={() => setActive(p)}>
                {t.forecast.platforms[p]}
                <span className="ui-tab__count">{summary.byPlatform[p].count}</span>
              </button>
            ))}
          </div>
        </div>
        <LinesTable key={active} rows={lines.filter((l) => l.platform === active)} platform={active} />
      </section>

      {active === 'gosi' && gosiEmployees.length ? (
        <section className="ui-card ui-card--flat">
          <div className="ui-card__head">
            <h2 className="ui-card__title">{t.forecast.gosiEmployees}</h2>
            <span className="text-xs text-muted">{t.forecast.perMonth}</span>
          </div>
          <GosiEmployeesTable rows={gosiEmployees} />
        </section>
      ) : null}
    </>
  );
}
