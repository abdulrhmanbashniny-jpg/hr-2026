import { Activity, ArrowUpRight, BadgePercent, Building2, CalendarClock, CircleDollarSign, Hourglass, Wallet } from 'lucide-react';
import Link from 'next/link';
import { ColumnChart } from '@/components/admin/charts';
import { ApprovePaymentButton, ExtendTrialButton } from '@/components/admin/quick-actions';
import { STATUS_FILL, StatusPill, type SubStatusKey } from '@/components/admin/status';
import { Avatar } from '@/components/app/topbar';
import { Card, Empty, PageHead } from '@/components/ui/card';
import { Kpi } from '@/components/ui/kpi';
import { platformOverview } from '@/lib/admin/metrics';
import { formatSar } from '@/lib/billing/pricing';
import { countOf, dayCount, f, fmtDate, fmtNumber, getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.overview.title };
}

export default async function AdminOverview() {
  const { t, locale } = await getI18n();
  const o = t.console.overview;
  const m = await platformOverview();
  const sar = (halalas: number) => fmtNumber(halalas / 100);
  const monthFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'short', timeZone: 'UTC' });
  const monthLong = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const revenueData = m.months.map((x) => {
    const d = new Date(`${x.key}-01T00:00:00Z`);
    return { label: monthFmt.format(d), title: monthLong.format(d), value: Math.round(x.value / 100) };
  });
  const weekData = m.weeks.map((w) => ({ label: fmtDate(w.start, locale).replace(/\s\d{4}$/, ''), title: fmtDate(w.start, locale), value: w.value }));
  const mixOrder: SubStatusKey[] = ['active', 'trialing', 'past_due', 'expired', 'canceled', 'none'];
  const mixTotal = mixOrder.reduce((s, k) => s + m.mix[k], 0);
  const maxPlan = Math.max(...m.mrrByPlan.map((p) => p.value), 1);
  const i = { size: 17, strokeWidth: 2 };
  const statusLabel = t.console.status;

  return (
    <>
      <PageHead title={o.title} sub={o.sub} eyebrow={<><Activity size={14} /> {t.console.name}</>} />

      <div className="kpi-grid kpi-grid--3">
        <Kpi color="blue" icon={<Wallet {...i} />} label={o.mrr} value={sar(m.mrr)} foot={f(o.mrrFoot, { arr: sar(m.arr) })} href="/admin/payments" />
        <Kpi color="green" icon={<CircleDollarSign {...i} />} label={o.activePaid} value={fmtNumber(m.paidCount)} foot={f(o.activePaidFoot, { m: m.monthlyN, y: m.yearlyN })} href="/admin/tenants" />
        <Kpi color="indigo" icon={<Hourglass {...i} />} label={o.trials} value={fmtNumber(m.mix.trialing)} foot={f(o.trialsFoot, { n: m.trialsEnding.length })} href="/admin/tenants" />
        <Kpi color="purple" icon={<BadgePercent {...i} />} label={o.conversion} value={m.conversion === null ? '—' : `${fmtNumber(m.conversion, 1)}%`} foot={o.conversionFoot} />
        <Kpi color="teal" icon={<Building2 {...i} />} label={o.newTenants} value={fmtNumber(m.newTenants30)} foot={f(o.newTenantsFoot, { prev: m.newTenantsPrev30 })} tone={m.newTenants30 >= m.newTenantsPrev30 ? 'up' : 'down'} />
        <Kpi color="orange" icon={<CalendarClock {...i} />} label={o.revenue30} value={sar(m.revenue30)} foot={f(o.revenue30Foot, { payments: countOf(m.revenue30Count, 'payment', locale) })} />
      </div>

      <div className="grid-2">
        <Card title={o.revenueByMonth} sub={o.revenueByMonthSub}>
          <ColumnChart data={revenueData} unit={t.common.sar} />
        </Card>
        <Card title={o.signupsByWeek} sub={o.signupsByWeekSub}>
          <ColumnChart data={weekData} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title={o.mix} sub={f(t.console.tenants.sub, { companies: countOf(m.tenantsTotal, 'company', locale) })}>
          <div className="flex flex-col gap-4">
            <div className="meter" role="img" aria-label={mixOrder.map((k) => `${statusLabel[k]} ${m.mix[k]}`).join('، ')}>
              {mixOrder.filter((k) => m.mix[k]).map((k) => (
                <span key={k} title={`${statusLabel[k]}: ${m.mix[k]}`} style={{ flexGrow: m.mix[k], background: STATUS_FILL[k] }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {mixOrder.map((k) => (
                <div key={k} className="stat">
                  <div className="stat__label flex items-center gap-1.5">
                    <span className="chart__swatch" style={{ background: STATUS_FILL[k] }} />
                    {statusLabel[k]}
                    <span className="ui-num ms-auto">{mixTotal ? `${fmtNumber((m.mix[k] / mixTotal) * 100)}%` : ''}</span>
                  </div>
                  <div className="stat__value">{fmtNumber(m.mix[k])}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title={o.mrrByPlan} sub={`${t.common.sar} · ${t.common.perMonth}`}>
          {m.mrrByPlan.length ? (
            <div className="bar-list">
              {m.mrrByPlan.map((p, idx) => (
                <div key={p.id} className="bar-list__row" style={{ gridTemplateColumns: 'minmax(90px, 150px) 1fr auto' }}>
                  <span className="truncate font-medium">
                    {locale === 'ar' ? p.nameAr : p.nameEn} <span className="text-muted">· {p.count}</span>
                  </span>
                  <span className="bar-list__track">
                    <span className="bar-list__fill block" style={{ width: `${(p.value / maxPlan) * 100}%`, background: `var(--chart-${idx + 1})` }} />
                  </span>
                  <span className="ui-num font-semibold">{sar(p.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{o.noData}</Empty>
          )}
        </Card>
      </div>

      <div className="grid-main">
        <div className="stack">
          <Card title={o.trialsEnding} action={<Link href="/admin/tenants" className="ui-btn ui-btn--ghost ui-btn--sm">{o.viewAll}</Link>} flat>
            {m.trialsEnding.length ? (
              <div className="list">
                {m.trialsEnding.map((x) => (
                  <div key={x.tenantId} className="list__row">
                    <Avatar name={x.name} />
                    <Link href={`/admin/tenants/${x.tenantId}`} className="list__main" style={{ color: 'inherit', textDecoration: 'none' }}>
                      <div className="list__title">{x.name}</div>
                      <div className="list__sub">{x.daysLeft ? f(o.daysLeft, { n: dayCount(x.daysLeft, locale) }) : o.endsToday}</div>
                    </Link>
                    <span className={`ui-pill ${x.daysLeft <= 2 ? 'ui-pill--red' : 'ui-pill--amber'}`}>{dayCount(x.daysLeft, locale)}</span>
                    <ExtendTrialButton tenantId={x.tenantId} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{o.noTrialsEnding}</Empty>
            )}
          </Card>
          <Card title={o.pending} action={<Link href="/admin/payments" className="ui-btn ui-btn--ghost ui-btn--sm">{o.viewAll}</Link>} flat>
            {m.pending.length ? (
              <div className="list">
                {m.pending.map((p) => {
                  const plan = p.planId ? m.planBy.get(p.planId) : undefined;
                  return (
                    <div key={p.id} className="list__row">
                      <Avatar name={p.tenant} />
                      <Link href={`/admin/tenants/${p.tenantId}`} className="list__main" style={{ color: 'inherit', textDecoration: 'none' }}>
                        <div className="list__title">{p.tenant}</div>
                        <div className="list__sub">
                          {plan ? (locale === 'ar' ? plan.nameAr : plan.nameEn) : '—'} · {t.console.cycle[p.cycle]} · {fmtDate(p.createdAt, locale)}
                        </div>
                      </Link>
                      <span className="ui-num font-semibold">{formatSar(p.total, locale)}</span>
                      <ApprovePaymentButton paymentId={p.id} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>{o.noPending}</Empty>
            )}
          </Card>
          <Card title={o.activity} action={<Link href="/admin/audit" className="ui-btn ui-btn--ghost ui-btn--sm">{o.viewAll}</Link>} flat>
            <div className="timeline py-2">
              {m.activity.map((a) => (
                <div key={a.id} className="timeline__item">
                  <span className="timeline__dot" style={a.action.startsWith('admin.') ? { background: 'var(--accent-2)' } : undefined} />
                  <div className="min-w-0 text-sm">
                    <div className="truncate-2">{a.summary}</div>
                    <div className="text-xs text-muted">
                      {[a.tenant ?? t.console.audit.platform, a.user, fmtDate(a.createdAt, locale, true)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title={o.usage}>
            <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {(
                [
                  [o.usageResidents, m.usage.residents],
                  [o.usageGosi, m.usage.gosi],
                  [o.usageVehicles, m.usage.vehicles],
                  [o.usageDocuments, m.usage.documents],
                  [o.usageAlerts, m.usage.alerts],
                  [o.usageUsers, m.usage.users],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="stat">
                  <div className="stat__label">{label}</div>
                  <div className="stat__value">{fmtNumber(n)}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title={o.recent} action={<Link href="/admin/tenants" className="ui-btn ui-btn--ghost ui-btn--sm">{o.viewAll}</Link>} flat>
            <div className="list">
              {m.recent.map((x) => (
                <Link key={x.id} href={`/admin/tenants/${x.id}`} className="list__row">
                  <Avatar name={x.name} />
                  <div className="list__main">
                    <div className="list__title">{x.name}</div>
                    <div className="list__sub">{fmtDate(x.createdAt, locale)}</div>
                  </div>
                  <StatusPill status={x.suspended ? 'suspended' : x.status} label={x.suspended ? statusLabel.suspended : statusLabel[x.status]} />
                  <ArrowUpRight size={15} className="text-muted" />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
