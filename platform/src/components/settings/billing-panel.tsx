'use client';

import { Check } from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { applyTrialExtension, checkout, quote, type QuoteData } from '@/app/app/settings/billing/actions';
import { Notice } from '@/components/ui/card';
import { SubmitButton, useActionFeedback } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { formatSar } from '@/lib/billing/pricing';
import { useI18n } from '@/lib/i18n/client';
import { f } from '@/lib/i18n/format';

interface PlanVM {
  id: string;
  code: string;
  name: string;
  description: string;
  monthly: number;
  yearly: number;
  maxEmployees: number | null;
  maxVehicles: number | null;
  maxUsers: number | null;
}

export function BillingPanel({ plans, currentPlanId, vatPercent, gateway, canExtendTrial, pendingPromo }: { plans: PlanVM[]; currentPlanId: string | null; vatPercent: number; gateway: boolean; canExtendTrial: boolean; pendingPromo: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [planId, setPlanId] = useState(currentPlanId ?? plans[1]?.id ?? plans[0]?.id ?? '');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [promo, setPromo] = useState(pendingPromo);
  const [q, setQ] = useState<QuoteData | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, action] = useActionState(checkout, null);
  useActionFeedback(state);

  useEffect(() => {
    if (!planId) return;
    start(async () => {
      const r = await quote(planId, cycle, promo);
      if (r.ok) {
        setQ(r.data ?? null);
        setPromoError(null);
      } else {
        setPromoError(r.error);
        const base = await quote(planId, cycle, '');
        setQ(base.ok ? (base.data ?? null) : null);
      }
    });
    // Recalculate on plan/cycle change; a typed promo applies only when "Apply" is pressed.
  }, [planId, cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPromo = () =>
    start(async () => {
      const r = await quote(planId, cycle, promo);
      if (r.ok) {
        setQ(r.data ?? null);
        setPromoError(null);
        if (r.data?.promoDescription) toast(f(t.billing.promoApplied, { desc: r.data.promoDescription }), 'ok');
        return;
      }
      if (canExtendTrial) {
        const ext = await applyTrialExtension(promo);
        if (ext.ok) {
          toast(ext.message ?? t.settings.saved, 'ok');
          setPromo('');
          setPromoError(null);
          return;
        }
      }
      setPromoError(r.error);
    });

  return (
    <section className="ui-card flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ui-card__title">{t.billing.choosePlan}</h2>
        <div className="ui-seg">
          <button type="button" aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>
            {t.billing.monthly}
          </button>
          <button type="button" aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>
            {t.billing.yearly}
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3" role="radiogroup">
        {plans.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={planId === p.id}
            onClick={() => setPlanId(p.id)}
            className="ui-card flex flex-col items-start gap-2 text-start"
            style={{ cursor: 'pointer', borderColor: planId === p.id ? 'var(--ink)' : undefined, borderWidth: planId === p.id ? 2 : 1, font: 'inherit', color: 'inherit' }}
          >
            <span className="flex w-full items-center justify-between">
              <b className="text-lg">{p.name}</b>
              {currentPlanId === p.id ? <span className="ui-pill ui-pill--green">{t.billing.currentPlan}</span> : planId === p.id ? <Check size={18} /> : null}
            </span>
            <span className="text-sm text-muted">{p.description}</span>
            <span className="ui-num text-2xl font-semibold">{formatSar(cycle === 'yearly' ? p.yearly : p.monthly, locale)}</span>
            <span className="text-xs text-muted">
              {p.maxEmployees ? f(t.billing.employees, { n: p.maxEmployees }) : t.common.unlimited} · {p.maxVehicles ? f(t.billing.vehicles, { n: p.maxVehicles }) : t.common.unlimited} · {p.maxUsers ? f(t.billing.users, { n: p.maxUsers }) : t.common.unlimited}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="ui-field">
          <span className="ui-label">{t.billing.promo}</span>
          <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="ui-input ui-input--ltr" style={{ width: 220 }} />
        </label>
        <button type="button" className="ui-btn ui-btn--ghost" disabled={pending || !promo} onClick={applyPromo}>
          {t.billing.apply}
        </button>
      </div>
      {promoError ? <Notice tone="red">{promoError}</Notice> : null}
      {q ? (
        <dl className="dl max-w-md">
          <dt>{t.billing.subtotal}</dt>
          <dd className="ui-num">{formatSar(q.subtotal, locale)}</dd>
          {q.discount ? (
            <>
              <dt>{t.billing.discount}</dt>
              <dd className="ui-num">− {formatSar(q.discount, locale)}</dd>
            </>
          ) : null}
          <dt>{f(t.billing.vat, { pct: vatPercent })}</dt>
          <dd className="ui-num">{formatSar(q.vat, locale)}</dd>
          <dt>
            <b>{t.billing.total}</b>
          </dt>
          <dd className="ui-num text-lg font-semibold">{formatSar(q.total, locale)}</dd>
        </dl>
      ) : null}
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="cycle" value={cycle} />
        <input type="hidden" name="promo" value={promoError ? '' : promo} />
        {gateway ? <SubmitButton variant="gold">{t.billing.pay}</SubmitButton> : null}
        <button type="submit" name="manual" value="1" className="ui-btn ui-btn--outline">
          {t.billing.requestManual}
        </button>
      </form>
    </section>
  );
}
