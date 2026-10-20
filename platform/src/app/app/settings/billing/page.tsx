import { asc, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { BillingPanel } from '@/components/settings/billing-panel';
import { Card, Notice, PageHead, Pill } from '@/components/ui/card';
import { db } from '@/db';
import { payments, plans, promoCodes, subscriptions } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { formatSar } from '@/lib/billing/pricing';
import { moyasarEnabled } from '@/lib/billing/moyasar';
import { env } from '@/lib/env';
import { f, fmtDate, getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.billing.title };
}

export default async function BillingPage(props: PageProps<'/app/settings/billing'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, s.tenant.id));
  const [list, history] = await Promise.all([
    db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder)),
    db.select().from(payments).where(eq(payments.tenantId, s.tenant.id)).orderBy(desc(payments.createdAt)).limit(50),
  ]);
  const current = sub?.planId ? list.find((p) => p.id === sub.planId) : undefined;
  const [pending] = sub?.pendingPromoCodeId ? await db.select().from(promoCodes).where(eq(promoCodes.id, sub.pendingPromoCodeId)) : [];
  const state = s.subscription;
  const statusTone = state?.canWrite ? (state.isTrial ? 'amber' : 'green') : 'red';
  return (
    <>
      <PageHead title={t.billing.title} />
      <div className="ui-tabs">
        <Link href="/app/settings" className="ui-tab">
          {t.settings.title}
        </Link>
        <span className="ui-tab" aria-selected="true">
          {t.settings.tabs.billing}
        </span>
      </div>
      {sp.paid ? <Notice tone="green">{t.billing.paymentSuccess}</Notice> : null}
      {sp.failed ? <Notice tone="red">{t.billing.paymentFailed}</Notice> : null}
      <Card title={t.billing.current}>
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone={statusTone}>{sub ? t.billing.status[sub.status] : '—'}</Pill>
          {current ? <b>{locale === 'ar' ? current.nameAr : current.nameEn}</b> : null}
          {sub?.status === 'trialing' && sub.trialEndsAt ? <span className="text-muted">{f(t.billing.trialEnds, { date: fmtDate(sub.trialEndsAt, locale) })}</span> : null}
          {sub?.currentPeriodEnd ? <span className="text-muted">{f(sub.status === 'active' ? t.billing.renews : t.billing.expiredOn, { date: fmtDate(sub.currentPeriodEnd, locale) })}</span> : null}
          {pending ? <Pill tone="blue">{t.billing.promo}: {pending.code}</Pill> : null}
        </div>
      </Card>
      {can(s.role, 'billing:manage') ? (
        <BillingPanel
          plans={list.map((p) => ({ id: p.id, code: p.code, name: locale === 'ar' ? p.nameAr : p.nameEn, description: locale === 'ar' ? p.descriptionAr : p.descriptionEn, monthly: p.priceMonthly, yearly: p.priceYearly, maxEmployees: p.maxEmployees, maxVehicles: p.maxVehicles, maxUsers: p.maxUsers }))}
          currentPlanId={sub?.planId ?? null}
          vatPercent={env.vatPercent}
          gateway={moyasarEnabled()}
          canExtendTrial={!!sub && !sub.currentPeriodEnd && (sub.status === 'trialing' || sub.status === 'expired')}
          pendingPromo={pending?.code ?? ''}
        />
      ) : (
        <Notice tone="blue">{t.billing.ownerOnly}</Notice>
      )}
      <Card title={t.billing.payments} flat>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>{t.common.date}</th>
                <th>{t.admin.plan}</th>
                <th>{t.billing.total}</th>
                <th>{t.common.status}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id}>
                  <td className="text-sm">{fmtDate(p.createdAt, locale, true)}</td>
                  <td className="text-sm">{list.find((x) => x.id === p.planId)?.[locale === 'ar' ? 'nameAr' : 'nameEn'] ?? '—'} · {p.billingCycle === 'yearly' ? t.billing.yearly : t.billing.monthly}</td>
                  <td className="whitespace-nowrap">{formatSar(p.total, locale)}</td>
                  <td>
                    <Pill tone={p.status === 'paid' ? 'green' : p.status === 'pending' ? 'amber' : 'red'}>{p.status === 'paid' ? t.billing.paid : p.status === 'pending' ? t.billing.pending : p.status === 'failed' ? t.billing.failed : t.billing.canceledPayment}</Pill>
                    {p.status === 'pending' && p.checkoutUrl ? (
                      <a href={p.checkoutUrl} className="ms-2 text-sm">
                        {t.billing.pay}
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length ? null : <div className="ui-empty">{t.common.noData}</div>}
        </div>
      </Card>
    </>
  );
}
