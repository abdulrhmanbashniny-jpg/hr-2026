'use client';

import { Pencil, Plus } from 'lucide-react';
import { useActionState, useCallback, useState, useTransition } from 'react';
import { approvePayment, cancelPayment, registerTelegramWebhook, runDailyNow, savePlan, savePromo } from '@/app/admin/actions';
import { Notice, Pill } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, SubmitButton, useActionFeedback } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { formatSar } from '@/lib/billing/pricing';
import { useI18n } from '@/lib/i18n/client';
import { fmtDate } from '@/lib/i18n/format';

function useRun() {
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
      start(async () => {
        const r = await fn();
        toast(r.ok ? (r.message ?? t.settings.saved) : (r.error ?? t.common.error), r.ok ? 'ok' : 'err');
      }),
  };
}

interface PlanVM {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priceMonthly: number;
  priceYearly: number;
  maxEmployees: number | null;
  maxVehicles: number | null;
  maxUsers: number | null;
  isActive: boolean;
  sortOrder: number;
}

function PlanForm({ plan, onClose }: { plan: PlanVM | null; onClose: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(savePlan.bind(null, plan?.id ?? null), null);
  useActionFeedback(state, onClose);
  return (
    <Modal open onClose={onClose} title={plan ? plan.nameAr : t.admin.newPlan} wide>
      <form action={action} className="grid gap-3.5 md:grid-cols-3">
        <Field label={t.admin.code} htmlFor="pl-code" required>
          <input id="pl-code" name="code" defaultValue={plan?.code} required className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.nameAr} htmlFor="pl-ar" required>
          <input id="pl-ar" name="nameAr" defaultValue={plan?.nameAr} required className="ui-input" />
        </Field>
        <Field label={t.admin.nameEn} htmlFor="pl-en">
          <input id="pl-en" name="nameEn" defaultValue={plan?.nameEn} className="ui-input ui-input--ltr" />
        </Field>
        <div className="md:col-span-3 grid gap-3.5 md:grid-cols-2">
          <Field label={t.admin.descAr} htmlFor="pl-dar">
            <textarea id="pl-dar" name="descriptionAr" defaultValue={plan?.descriptionAr} className="ui-textarea" style={{ minHeight: 70 }} />
          </Field>
          <Field label={t.admin.descEn} htmlFor="pl-den">
            <textarea id="pl-den" name="descriptionEn" defaultValue={plan?.descriptionEn} className="ui-textarea ui-input--ltr" style={{ minHeight: 70 }} />
          </Field>
        </div>
        <Field label={t.admin.priceMonthly} htmlFor="pl-pm" required>
          <input id="pl-pm" name="priceMonthly" type="number" step="0.01" min={0} defaultValue={plan ? plan.priceMonthly / 100 : ''} required className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.priceYearly} htmlFor="pl-py" required>
          <input id="pl-py" name="priceYearly" type="number" step="0.01" min={0} defaultValue={plan ? plan.priceYearly / 100 : ''} required className="ui-input ui-input--ltr" />
        </Field>
        <Field label="#" htmlFor="pl-sort">
          <input id="pl-sort" name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.maxEmployees} htmlFor="pl-me" hint={t.common.unlimited}>
          <input id="pl-me" name="maxEmployees" type="number" min={0} defaultValue={plan?.maxEmployees ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.maxVehicles} htmlFor="pl-mv" hint={t.common.unlimited}>
          <input id="pl-mv" name="maxVehicles" type="number" min={0} defaultValue={plan?.maxVehicles ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.maxUsers} htmlFor="pl-mu" hint={t.common.unlimited}>
          <input id="pl-mu" name="maxUsers" type="number" min={0} defaultValue={plan?.maxUsers ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} className="ui-check" />
          {t.admin.activeFlag}
        </label>
        <div className="ui-modal__foot md:col-span-3" style={{ margin: '0 -20px -20px' }}>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function PlansManager({ plans }: { plans: PlanVM[] }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<PlanVM | 'new' | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const columns: Column<PlanVM>[] = [
    { key: 'code', header: t.admin.code, cell: (p) => <code className="ui-num">{p.code}</code>, sort: (p) => p.sortOrder },
    { key: 'name', header: t.common.name, cell: (p) => <b>{locale === 'ar' ? p.nameAr : p.nameEn}</b> },
    { key: 'price', header: t.admin.priceMonthly, cell: (p) => <span className="ui-num">{formatSar(p.priceMonthly, locale)} · {formatSar(p.priceYearly, locale)}</span> },
    { key: 'limits', header: `${t.admin.maxEmployees} / ${t.admin.maxVehicles} / ${t.admin.maxUsers}`, cell: (p) => <span className="ui-num">{p.maxEmployees ?? '∞'} / {p.maxVehicles ?? '∞'} / {p.maxUsers ?? '∞'}</span> },
    { key: 'active', header: t.common.status, cell: (p) => <Pill tone={p.isActive ? 'green' : 'gray'}>{p.isActive ? t.common.active : t.common.archived}</Pill> },
    { key: 'edit', header: '', cell: (p) => <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setEditing(p)} aria-label={t.common.edit}><Pencil size={16} /></button> },
  ];
  return (
    <>
      <DataTable
        rows={plans}
        columns={columns}
        rowKey={(p) => p.id}
        toolbar={
          <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setEditing('new')}>
            <Plus size={16} />
            {t.admin.newPlan}
          </button>
        }
      />
      {editing ? <PlanForm plan={editing === 'new' ? null : editing} onClose={close} /> : null}
    </>
  );
}

interface PromoVM {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'trial_extension';
  value: number;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  planCodes: string[] | null;
  isActive: boolean;
  note: string | null;
}

function PromoForm({ promo, planCodes, onClose }: { promo: PromoVM | null; planCodes: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(savePromo.bind(null, promo?.id ?? null), null);
  useActionFeedback(state, onClose);
  const [kind, setKind] = useState(promo?.kind ?? 'percent');
  return (
    <Modal open onClose={onClose} title={promo ? promo.code : t.admin.newPromo}>
      <form action={action} className="grid gap-3.5 md:grid-cols-2">
        <Field label={t.admin.code} htmlFor="pr-code" required>
          <input id="pr-code" name="code" defaultValue={promo?.code} required className="ui-input ui-input--ltr" style={{ textTransform: 'uppercase' }} />
        </Field>
        <Field label={t.admin.kind} htmlFor="pr-kind">
          <select id="pr-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as PromoVM['kind'])} className="ui-select">
            {(['percent', 'fixed', 'trial_extension'] as const).map((k) => (
              <option key={k} value={k}>
                {t.admin.kinds[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`${t.admin.value} (${t.admin.kinds[kind]})`} htmlFor="pr-value" required>
          <input id="pr-value" name="value" type="number" step={kind === 'fixed' ? '0.01' : '1'} min={1} defaultValue={promo ? (promo.kind === 'fixed' ? promo.value / 100 : promo.value) : ''} required className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.maxRedemptions} htmlFor="pr-max" hint={t.common.unlimited}>
          <input id="pr-max" name="maxRedemptions" type="number" min={1} defaultValue={promo?.maxRedemptions ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.validFrom} htmlFor="pr-from">
          <input id="pr-from" name="validFrom" type="date" defaultValue={promo?.validFrom?.slice(0, 10) ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.admin.validUntil} htmlFor="pr-until">
          <input id="pr-until" name="validUntil" type="date" defaultValue={promo?.validUntil?.slice(0, 10) ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <fieldset className="md:col-span-2 flex flex-wrap items-center gap-3">
          <legend className="ui-label">{t.admin.plansFor}</legend>
          {planCodes.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="planCodes" value={c} defaultChecked={promo?.planCodes?.includes(c)} className="ui-check" />
              <code>{c}</code>
            </label>
          ))}
        </fieldset>
        <div className="md:col-span-2">
          <Field label={t.common.note} htmlFor="pr-note">
            <input id="pr-note" name="note" defaultValue={promo?.note ?? ''} className="ui-input" />
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={promo?.isActive ?? true} className="ui-check" />
          {t.admin.activeFlag}
        </label>
        <div className="ui-modal__foot md:col-span-2" style={{ margin: '0 -20px -20px' }}>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function PromosManager({ promos, planCodes }: { promos: PromoVM[]; planCodes: string[] }) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<PromoVM | 'new' | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const value = (p: PromoVM) => (p.kind === 'percent' ? `${p.value}%` : p.kind === 'fixed' ? formatSar(p.value, locale) : `+${p.value}d`);
  const columns: Column<PromoVM>[] = [
    { key: 'code', header: t.admin.code, cell: (p) => <code className="ui-num font-semibold">{p.code}</code>, sort: (p) => p.code, csv: (p) => p.code },
    { key: 'kind', header: t.admin.kind, cell: (p) => t.admin.kinds[p.kind], csv: (p) => p.kind },
    { key: 'value', header: t.admin.value, cell: (p) => <span className="ui-num">{value(p)}</span>, csv: (p) => p.value },
    { key: 'until', header: t.admin.validUntil, cell: (p) => (p.validUntil ? fmtDate(p.validUntil, locale) : '—'), sort: (p) => p.validUntil, csv: (p) => p.validUntil },
    { key: 'used', header: t.admin.redeemed, cell: (p) => <span className="ui-num">{p.redeemedCount} / {p.maxRedemptions ?? '∞'}</span>, sort: (p) => p.redeemedCount, csv: (p) => p.redeemedCount },
    { key: 'plans', header: t.admin.plansFor, cell: (p) => (p.planCodes?.length ? p.planCodes.join(', ') : t.common.all), hideSm: true },
    {
      key: 'status',
      header: t.common.status,
      cell: (p) => {
        const expired = p.validUntil && new Date(p.validUntil) < new Date();
        return <Pill tone={!p.isActive || expired ? 'gray' : 'green'}>{!p.isActive ? t.admin.activeFlag + ' ✕' : expired ? t.promoProblems.expired : t.common.active}</Pill>;
      },
    },
    { key: 'edit', header: '', cell: (p) => <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setEditing(p)} aria-label={t.common.edit}><Pencil size={16} /></button> },
  ];
  return (
    <>
      <DataTable
        rows={promos}
        columns={columns}
        rowKey={(p) => p.id}
        search={(p) => `${p.code} ${p.note ?? ''}`}
        exportName="promo-codes"
        toolbar={
          <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setEditing('new')}>
            <Plus size={16} />
            {t.admin.newPromo}
          </button>
        }
      />
      {editing ? <PromoForm promo={editing === 'new' ? null : editing} planCodes={planCodes} onClose={close} /> : null}
    </>
  );
}

interface PaymentVM {
  id: string;
  tenant: string;
  plan: string;
  cycle: 'monthly' | 'yearly';
  total: number;
  discount: number;
  provider: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  createdAt: string;
}

export function PaymentsTable({ rows }: { rows: PaymentVM[] }) {
  const { t, locale } = useI18n();
  const { pending, run } = useRun();
  const columns: Column<PaymentVM>[] = [
    { key: 'when', header: t.common.date, cell: (p) => <span className="text-sm">{fmtDate(p.createdAt, locale, true)}</span>, sort: (p) => p.createdAt, csv: (p) => p.createdAt },
    { key: 'tenant', header: t.admin.company, cell: (p) => <b>{p.tenant}</b>, sort: (p) => p.tenant, csv: (p) => p.tenant },
    { key: 'plan', header: t.admin.plan, cell: (p) => `${p.plan} · ${p.cycle === 'yearly' ? t.billing.yearly : t.billing.monthly}`, csv: (p) => p.plan },
    { key: 'total', header: t.billing.total, cell: (p) => <span className="ui-num">{formatSar(p.total, locale)}</span>, sort: (p) => p.total, csv: (p) => p.total / 100 },
    { key: 'provider', header: 'Provider', cell: (p) => <code>{p.provider}</code>, csv: (p) => p.provider },
    { key: 'status', header: t.common.status, cell: (p) => <Pill tone={p.status === 'paid' ? 'green' : p.status === 'pending' ? 'amber' : 'red'}>{t.console.paymentStatus[p.status]}</Pill>, sort: (p) => p.status, csv: (p) => p.status },
    {
      key: 'actions',
      header: '',
      cell: (p) =>
        p.status === 'pending' ? (
          <div className="flex gap-1.5">
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={pending} onClick={() => window.confirm(`${t.admin.approve}?`) && run(() => approvePayment(p.id))}>
              {t.admin.approve}
            </button>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => cancelPayment(p.id))}>
              {t.common.cancel}
            </button>
          </div>
        ) : null,
    },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(p) => p.id} search={(p) => `${p.tenant} ${p.plan}`} filters={[{ id: 'pending', label: t.billing.pending, predicate: (p) => p.status === 'pending' }]} exportName="payments" />;
}

export function SystemPanel({ status }: { status: { telegram: boolean; botUsername: string; webhookSecret: boolean; email: boolean; moyasar: boolean; storage: string; cron: boolean; appUrl: string } }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  const row = (label: string, ok: boolean, detail?: string) => (
    <li className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
      <span>{label}</span>
      <span className="flex items-center gap-2">
        {detail ? <span className="ltr text-xs text-muted">{detail}</span> : null}
        <Pill tone={ok ? 'green' : 'amber'}>{ok ? '✓' : '—'}</Pill>
      </span>
    </li>
  );
  return (
    <div className="flex flex-col gap-5">
      <ul>
        {row('APP_URL', true, status.appUrl)}
        {row('Telegram bot (TELEGRAM_BOT_TOKEN)', status.telegram, status.botUsername ? `@${status.botUsername}` : undefined)}
        {row('Telegram webhook secret', status.webhookSecret)}
        {row('Platform SMTP', status.email)}
        {row('Moyasar payments', status.moyasar)}
        {row('Storage driver', true, status.storage)}
        {row('CRON_SECRET', status.cron)}
      </ul>
      {!status.telegram ? <Notice tone="amber">{t.settings.botNotConfigured}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ui-btn ui-btn--primary" disabled={pending || !status.telegram} onClick={() => run(() => registerTelegramWebhook())}>
          {t.admin.setWebhook}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost" disabled={pending} onClick={() => run(() => runDailyNow())}>
          {t.admin.runDaily}
        </button>
      </div>
    </div>
  );
}
