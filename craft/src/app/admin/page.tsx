import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import { Banknote, CalendarDays, CircleCheck, Download, Eye, Inbox, MapPin, PieChart, ShieldAlert, SlidersHorizontal, UserCheck, UserPlus, Users, X } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { cities, craftsmen, incentiveRules, referrals, regions, users } from '@/db/schema';
import { approveInvoiceAction, rejectInvoiceAction } from './actions';
import { ActionButton } from '@/components/admin/action-button';
import { KsaMap } from '@/components/admin/charts';
import { MonthlyChart } from '@/components/admin/overview/monthly-chart';
import { Avatar } from '@/components/ui/avatar';
import { consoleOverview, PERIODS, type Period } from '@/lib/admin/overview';
import { reviewQueue } from '@/lib/admin/invoices';
import { requireStaffPage } from '@/lib/auth/guards';
import { staffCan } from '@/lib/auth/roles';
import { f, fmtDate, fmtMoney, fmtNumber, fmtRelative, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';
import { adminOverviewStrings } from '@/lib/i18n/pages/admin-overview';
import { maskPhone } from '@/lib/phone';
import { mediaUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const TIER_COLOR = { A: '#102a43', B: '#f59e0b', C: '#94a3b8' } as const;

export default async function ConsoleOverview({ searchParams }: { searchParams: Promise<{ denied?: string; days?: string }> }) {
  const session = await requireStaffPage();
  const { locale, t } = await getI18n();
  const c = consoleDictionary(locale);
  const s = adminOverviewStrings(locale);
  const sp = await searchParams;
  const days = (PERIODS as readonly number[]).includes(Number(sp.days)) ? (Number(sp.days) as Period) : 30;
  const now = new Date();
  const canReview = staffCan(session.user.role, 'invoices:review');

  const [o, queue, latest, rules] = await Promise.all([
    consoleOverview(days),
    reviewQueue({ limit: 3 }),
    db
      .select({ c: craftsmen, phone: users.phone, status: users.status, cityAr: cities.nameAr, cityEn: cities.nameEn })
      .from(craftsmen)
      .innerJoin(users, eq(users.id, craftsmen.userId))
      .innerJoin(cities, eq(cities.id, craftsmen.cityId))
      .orderBy(desc(craftsmen.createdAt))
      .limit(5),
    db
      .select({ r: incentiveRules, regionAr: regions.nameAr, regionEn: regions.nameEn, cityAr: cities.nameAr, cityEn: cities.nameEn })
      .from(incentiveRules)
      .leftJoin(regions, eq(regions.code, incentiveRules.regionCode))
      .leftJoin(cities, eq(cities.id, incentiveRules.cityId))
      .where(and(eq(incentiveRules.isActive, true), lte(incentiveRules.startsAt, now), gte(incentiveRules.endsAt, now)))
      .orderBy(desc(incentiveRules.multiplier))
      .limit(4),
  ]);
  const confirmedBy = new Map(
    (
      await db
        .select({ id: referrals.referrerId, n: count() })
        .from(referrals)
        .where(eq(referrals.status, 'activated'))
        .groupBy(referrals.referrerId)
    ).map((r) => [r.id, r.n]),
  );

  const k = o.kpis;
  const growth = k.newBefore ? Math.round(((k.newNow - k.newBefore) / k.newBefore) * 100) : null;
  const confirmRate = k.referrals ? Math.round((k.confirmed / k.referrals) * 100) : 0;
  const tierCount = o.tiers.A + o.tiers.B + o.tiers.C;
  const totalTiers = tierCount || 1;
  // No region is the busiest before anyone has joined.
  const topRegion = [...o.regions].filter((r) => r.referrals_now > 0 || r.craftsmen > 0).sort((a, b) => b.referrals_now - a.referrals_now || b.craftsmen - a.craftsmen)[0];
  const name = (x: { name_ar: string; name_en: string }) => (locale === 'ar' ? x.name_ar : x.name_en);

  // Donut segments
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segments = (['A', 'B', 'C'] as const).map((tier) => {
    const len = (o.tiers[tier] / totalTiers) * C;
    const seg = { tier, len, offset };
    offset += len;
    return seg;
  });

  const card = 'rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg';
  const kpi = 'flex flex-col justify-between gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm';
  const bucket = 'grid size-10 place-items-center rounded-lg bg-canvas text-primary-container';

  return (
    <div className="flex flex-col gap-space-lg">
      {sp.denied && <div className="rounded-xl bg-warning-soft p-3 text-body-sm text-warning">{c.denied}</div>}

      {/* Header card */}
      <div className={`${card} flex flex-col justify-between gap-space-md lg:flex-row lg:items-center`}>
        <div>
          <div className="flex flex-wrap items-center gap-space-sm text-label-sm">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[rgb(16_185_129/0.1)] px-2 py-1 text-[#047857]">
              <span className="size-1.5 animate-pulse rounded-full bg-[#10b981]" />
              {s.live}
            </span>
            <span className="text-muted">{f(s.updated, { time: new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }).format(now) })}</span>
          </div>
          <h1 className="mt-space-xs text-headline-lg-mobile text-primary sm:text-headline-lg">{s.title}</h1>
          <p className="mt-1 max-w-2xl text-body-md text-on-surface-variant">{s.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Link href="/admin/reports" className="press inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-container-lowest px-space-md text-label-md text-primary-container shadow-xs hover:bg-canvas">
            <Download className="size-4" />
            {s.export}
          </Link>
          <div className="flex h-11 items-center gap-1 rounded-xl border border-line bg-surface-container-lowest p-1 shadow-xs" role="group" aria-label={s.period}>
            <CalendarDays className="mx-1.5 size-4 text-muted" />
            {PERIODS.map((p) => (
              <Link key={p} href={`/admin?days=${p}`} aria-current={p === days ? 'true' : undefined} className={`rounded-lg px-2.5 py-1.5 text-label-sm ${p === days ? 'bg-primary-container text-white' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                {s.periods[p]}
              </Link>
            ))}
          </div>
          <Link href="/admin/verification" className="press amber-gradient inline-flex h-11 items-center gap-2 rounded-xl px-space-md text-label-lg text-primary-container shadow-md hover:brightness-105">
            <UserCheck className="size-5" />
            {s.approveMember}
          </Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-5">
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.craftsmen}</span>
            <span className={bucket}>
              <Users className="size-5" />
            </span>
          </div>
          <div>
            <div className="num text-headline-xl text-primary">{fmtNumber(k.craftsmen)}</div>
            {growth !== null && (
              <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-label-sm ${growth >= 0 ? 'bg-[rgb(16_185_129/0.1)] text-[#047857]' : 'bg-[rgb(239_68_68/0.1)] text-[#B91C1C]'}`}>
                {f(s.kpi.growth, { n: `${growth >= 0 ? '+' : ''}${growth}` })}
              </span>
            )}
          </div>
        </div>
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.newMembers}</span>
            <span className={bucket}>
              <UserPlus className="size-5" />
            </span>
          </div>
          <div>
            <div className="num text-headline-xl text-primary">{fmtNumber(k.newNow)}</div>
            <span className="mt-1 inline-flex rounded-md bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant">{s.kpi.newHint}</span>
          </div>
        </div>
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.referrals}</span>
            <span className={bucket}>
              <UserPlus className="size-5" />
            </span>
          </div>
          <div>
            <div className="num text-headline-xl text-primary">{fmtNumber(k.referrals)}</div>
            <span className="mt-1 inline-flex rounded-md bg-surface-container px-2 py-0.5 text-label-sm text-on-surface-variant">{f(s.kpi.referralsHint, { n: k.referralsNow })}</span>
          </div>
        </div>
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.confirmed}</span>
            <span className={bucket}>
              <CircleCheck className="size-5" />
            </span>
          </div>
          <div>
            <div className="num text-headline-xl text-primary">{fmtNumber(k.confirmed)}</div>
            <span className="mt-1 inline-flex rounded-md bg-[rgb(16_185_129/0.1)] px-2 py-0.5 text-label-sm text-[#047857]">{f(s.kpi.rate, { n: confirmRate })}</span>
          </div>
        </div>
        <div className="vip-surface flex flex-col justify-between gap-space-md rounded-2xl p-space-md text-white">
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-primary-container">{s.kpi.paid}</span>
            <span className="grid size-10 place-items-center rounded-lg bg-white/10 text-secondary-fixed-dim">
              <Banknote className="size-5" />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="num text-headline-xl text-white">{fmtNumber(Math.round(k.paidSar || k.redeemedPoints * o.pointValueSar))}</span>
              <span className="text-label-sm text-on-primary-container">{s.kpi.sar}</span>
            </div>
            <span className="mt-1 inline-flex items-center gap-1 text-label-sm text-secondary-fixed-dim">{f(s.kpi.paidHint, { n: fmtNumber(k.redeemedPoints) })}</span>
          </div>
        </div>
      </div>

      {/* Trend + tiers */}
      <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
        <section className={`${card} xl:col-span-8`}>
          <h2 className="text-headline-sm text-primary">{s.chart.title}</h2>
          <p className="mb-space-md text-body-sm text-on-surface-variant">{s.chart.subtitle}</p>
          <MonthlyChart rows={o.months} labels={{ signups: s.chart.signups, confirmed: s.chart.confirmed, month: s.chart.month }} />
          <dl className="mt-space-md grid grid-cols-3 gap-space-sm border-t border-line pt-space-md text-center">
            <div>
              <dt className="text-label-sm text-muted">{s.chart.growth}</dt>
              <dd className="num mt-1 text-headline-sm text-primary">{o.monthlyGrowth === null ? '—' : `${o.monthlyGrowth >= 0 ? '+' : ''}${Math.round(o.monthlyGrowth * 100)}%`}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-muted">{s.chart.region}</dt>
              <dd className="mt-1 text-headline-sm text-primary">{topRegion ? name(topRegion) : '—'}</dd>
            </div>
            <div>
              <dt className="text-label-sm text-muted">{s.chart.perCraftsman}</dt>
              <dd className="num mt-1 text-headline-sm text-primary">{k.craftsmen ? (k.referrals / k.craftsmen).toFixed(1) : '0'}</dd>
            </div>
          </dl>
        </section>

        <section className={`${card} flex flex-col xl:col-span-4`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-headline-sm text-primary">{s.tiers.title}</h2>
              <p className="text-body-sm text-on-surface-variant">{s.tiers.subtitle}</p>
            </div>
            <PieChart className="size-5 text-secondary" />
          </div>
          <div className="relative my-space-md flex items-center justify-center">
            <svg viewBox="0 0 140 140" className="size-44 -rotate-90" role="img" aria-label={s.tiers.title}>
              <circle cx={70} cy={70} r={R} fill="none" stroke="var(--surface-container)" strokeWidth={18} />
              {segments.map((g) => (
                <circle key={g.tier} cx={70} cy={70} r={R} fill="none" stroke={TIER_COLOR[g.tier]} strokeWidth={18} strokeDasharray={`${Math.max(0, g.len - 2)} ${C}`} strokeDashoffset={-g.offset} />
              ))}
            </svg>
            <div className="absolute text-center">
              <div className="num text-headline-md text-primary">{fmtNumber(tierCount)}</div>
              <div className="text-label-sm text-muted">{s.tiers.total}</div>
            </div>
          </div>
          <ul className="space-y-space-sm">
            {(['A', 'B', 'C'] as const).map((tier) => {
              const pct = Math.round((o.tiers[tier] / totalTiers) * 100);
              return (
                <li key={tier}>
                  <div className="flex items-center justify-between text-label-md">
                    <span className="flex items-center gap-2 text-on-surface">
                      <span className="size-2.5 rounded-full" style={{ background: TIER_COLOR[tier] }} />
                      {t.tiers.role[tier]}
                    </span>
                    <span className="num text-primary">
                      {pct}% · {fmtNumber(o.tiers[tier])}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TIER_COLOR[tier] }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/craftsmen" className="mt-auto flex items-center justify-between rounded-xl bg-surface-container-low px-space-md py-space-sm pt-space-sm text-label-sm text-on-surface-variant hover:bg-surface-container">
            <span>{f(s.tiers.note, { n: Math.round((o.tiers.A / totalTiers) * 100) })}</span>
            <span className="text-secondary">{s.tiers.manage}</span>
          </Link>
        </section>
      </div>

      {/* Geography */}
      <section className={card}>
        <div className="mb-space-md flex items-end justify-between gap-space-md">
          <div>
            <h2 className="text-headline-sm text-primary">{s.geo.title}</h2>
            <p className="text-body-sm text-on-surface-variant">{s.geo.subtitle}</p>
          </div>
          <Link href="/admin/map" className="shrink-0 rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container-high">
            {s.geo.map}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-space-sm md:grid-cols-3 xl:grid-cols-6">
          {o.cities.slice(0, 6).map((x) => {
            const share = x.craftsmen ? Math.round((x.active / x.craftsmen) * 100) : 0;
            return (
              <div key={x.id} className="rounded-xl border border-line p-space-sm">
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 text-label-md text-primary">
                    <MapPin className="size-3.5 text-secondary" />
                    {name(x)}
                  </span>
                  {x.new_now > 0 && <span className="rounded bg-secondary-fixed/60 px-1.5 text-[10px] font-bold text-on-secondary-fixed-variant">{f(s.geo.new, { n: x.new_now })}</span>}
                </div>
                <div className="num mt-space-xs text-headline-md text-primary">{fmtNumber(x.craftsmen)}</div>
                <div className="text-label-sm text-muted">
                  {s.geo.craftsmen} · {share}% {s.geo.active}
                </div>
                <div className="mt-space-xs h-1 overflow-hidden rounded-full bg-surface-container">
                  <div className="h-full rounded-full bg-primary-container" style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-space-md">
          <KsaMap cities={o.cities.map((x) => ({ id: x.id, name: name(x), lat: x.lat, lng: x.lng, craftsmen: x.craftsmen, active: x.active, invoices: x.invoices }))} />
        </div>
      </section>

      {/* Approvals */}
      <section className={card}>
        <div className="mb-space-md flex flex-col justify-between gap-space-sm md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <h2 className="text-headline-sm text-primary">{s.approvals.title}</h2>
              {k.referralsOpen > 0 && <span className="rounded-md bg-[rgb(245_158_11/0.1)] px-2 py-0.5 text-label-sm text-[#B45309]">{f(s.approvals.held, { n: k.referralsOpen })}</span>}
            </div>
            <p className="text-body-sm text-on-surface-variant">{s.approvals.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1 text-label-sm">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
              <Link key={tab} href={`/admin/invoices${tab === 'all' ? '' : `?tab=${tab === 'pending' ? 'open' : tab}`}`} className={`rounded-lg px-2.5 py-1.5 ${tab === 'all' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}>
                {s.approvals.tabs[tab]} <span className="num">({fmtNumber(o.invoiceTabs[tab])})</span>
              </Link>
            ))}
          </div>
        </div>
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-space-sm rounded-xl bg-surface-container-low px-space-lg py-space-xl text-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-secondary-fixed/50 text-secondary">
              <Inbox className="size-8" />
            </span>
            <p className="text-headline-sm text-primary">{s.approvals.empty}</p>
            <p className="max-w-sm text-body-sm text-on-surface-variant">{s.approvals.emptyBody}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
            {queue.map((q) => (
              <article key={q.inv.id} className="flex flex-col rounded-xl border border-line p-space-md">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-label-sm ${q.inv.status === 'flagged' ? 'bg-[rgb(239_68_68/0.1)] text-[#B91C1C]' : 'bg-[rgb(245_158_11/0.1)] text-[#B45309]'}`}>
                    {q.inv.status === 'flagged' ? c.invoices.tabs.flagged : c.invoices.tabs.open}
                  </span>
                  <span className="text-label-sm text-muted">{fmtRelative(q.inv.createdAt, locale)}</span>
                </div>
                <Link href={`/admin/craftsmen/${q.craftsman.id}`} className="mt-space-sm text-label-lg text-primary hover:underline">
                  {q.craftsman.name}
                </Link>
                <div className="text-body-sm text-on-surface-variant">
                  {s.approvals.dealer}: {q.dealer?.name ?? s.approvals.unknownDealer}
                </div>
                <div className="mt-space-sm flex items-center justify-between border-t border-line pt-space-sm text-body-sm">
                  <span className="text-on-surface-variant">{s.approvals.amount}</span>
                  <span className="num font-semibold text-primary">{q.inv.totalAmount ? fmtMoney(q.inv.totalAmount, locale, 2) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-on-surface-variant">{f(s.approvals.risk, { n: q.inv.riskScore ?? 0 })}</span>
                  <ShieldAlert className={`size-4 ${(q.inv.riskScore ?? 0) >= 60 ? 'text-[#B91C1C]' : 'text-muted'}`} />
                </div>
                {canReview && (
                  <div className="mt-space-md flex items-center gap-space-sm">
                    <div className="flex-1 [&_button]:w-full">
                      <ActionButton action={approveInvoiceAction.bind(null, q.inv.id, undefined)} variant="primary" icon={<CircleCheck className="size-4" />}>
                        {s.approvals.approveNoPoints}
                      </ActionButton>
                    </div>
                    <ActionButton action={rejectInvoiceAction.bind(null, q.inv.id, undefined)} variant="danger" confirm={s.approvals.rejectConfirm} icon={<X className="size-4" />}>
                      {s.approvals.reject}
                    </ActionButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="mt-space-md text-center">
          <Link href="/admin/invoices" className="text-label-md text-secondary hover:underline">
            {s.approvals.open}
          </Link>
        </div>
      </section>

      {/* Latest craftsmen */}
      <section className={card}>
        <div className="mb-space-md flex items-end justify-between gap-space-md">
          <div>
            <h2 className="text-headline-sm text-primary">{s.table.title}</h2>
            <p className="text-body-sm text-on-surface-variant">{s.table.subtitle}</p>
          </div>
          <Link href="/admin/craftsmen" className="shrink-0 text-label-md text-secondary hover:underline">
            {s.table.all}
          </Link>
        </div>
        <div className="-mx-space-md overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-line bg-canvas text-label-sm text-muted">
                {Object.values(s.table.cols).map((h) => (
                  <th key={h} className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line whitespace-nowrap">
              {latest.map((r) => {
                const status = r.status === 'suspended' ? 'suspended' : r.c.identityStatus === 'verified' ? 'active' : 'pending';
                const tone = { active: 'bg-[rgb(16_185_129/0.1)] text-[#047857]', pending: 'bg-[rgb(245_158_11/0.1)] text-[#B45309]', suspended: 'bg-[rgb(239_68_68/0.1)] text-[#B91C1C]' }[status];
                return (
                  <tr key={r.c.id} className="h-[60px] transition-colors hover:bg-canvas">
                    <td className="px-4">
                      <span className="flex items-center gap-space-sm">
                        <Avatar name={r.c.displayName} src={mediaUrl(r.c.avatarKey)} size={36} className="rounded-full" />
                        <span className="text-label-lg text-primary">{r.c.displayName}</span>
                      </span>
                    </td>
                    <td className="num px-4 text-body-sm text-on-surface-variant">{maskPhone(r.phone)}</td>
                    <td className="px-4">
                      <span className="rounded-md bg-secondary-fixed/50 px-2 py-1 text-label-sm text-on-secondary-fixed-variant">{t.tiers.badge[r.c.tier]}</span>
                    </td>
                    <td className="px-4 text-body-sm text-on-surface-variant">{locale === 'ar' ? r.cityAr : r.cityEn}</td>
                    <td className="px-4">
                      <span className="code-id rounded-md bg-surface-container px-2 py-1 text-label-sm text-primary">{r.c.referralCode}</span>
                    </td>
                    <td className="num px-4 text-label-lg text-primary">{fmtNumber(confirmedBy.get(r.c.id) ?? 0)}</td>
                    <td className="px-4 text-body-sm text-on-surface-variant">{fmtDate(r.c.createdAt, locale)}</td>
                    <td className="px-4">
                      <span className={`inline-flex h-[26px] items-center rounded-md px-2.5 text-label-sm ${tone}`}>{s.table.statuses[status]}</span>
                    </td>
                    <td className="px-4">
                      <Link href={`/admin/craftsmen/${r.c.id}`} className="grid size-9 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary" aria-label={s.table.open}>
                        <Eye className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Incentives by region */}
      <section className={card}>
        <div className="mb-space-md flex items-end justify-between gap-space-md">
          <div>
            <h2 className="text-headline-sm text-primary">{s.incentives.title}</h2>
            <p className="text-body-sm text-on-surface-variant">{s.incentives.subtitle}</p>
          </div>
          <Link href="/admin/incentives" className="inline-flex shrink-0 items-center gap-1.5 text-label-md text-secondary hover:underline">
            <SlidersHorizontal className="size-4" />
            {s.incentives.manage}
          </Link>
        </div>
        {rules.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low p-space-md text-center text-body-sm text-on-surface-variant">{s.incentives.none}</p>
        ) : (
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 xl:grid-cols-4">
            {rules.map(({ r, regionAr, regionEn, cityAr, cityEn }) => (
              <div key={r.id} className="rounded-xl border border-line p-space-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label-md text-primary">{r.scope === 'city' ? (locale === 'ar' ? cityAr : cityEn) : r.scope === 'region' ? (locale === 'ar' ? regionAr : regionEn) : s.incentives.national}</span>
                  <span className="size-2 rounded-full bg-[#10b981]" />
                </div>
                <div className="mt-1 truncate text-body-sm text-on-surface-variant">{r.name}</div>
                <div className="mt-space-sm flex flex-wrap gap-1 text-label-sm">
                  <span className="rounded-md bg-primary-container px-2 py-0.5 text-white">{f(s.incentives.multiplier, { n: r.multiplier })}</span>
                  {r.flatBonus > 0 && <span className="rounded-md bg-secondary-fixed/60 px-2 py-0.5 text-on-secondary-fixed-variant">{f(s.incentives.bonus, { n: r.flatBonus })}</span>}
                  <span className="rounded-md bg-surface-container px-2 py-0.5 text-on-surface-variant">{s.incentives.targets[r.target]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
