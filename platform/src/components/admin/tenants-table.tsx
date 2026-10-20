'use client';

import { useActionState, useCallback, useState, useTransition } from 'react';
import { activatePlan, extendTrial, toggleSuspend } from '@/app/admin/actions';
import { Pill } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Field, SubmitButton, useActionFeedback } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import { fmtDate } from '@/lib/i18n/format';

export interface TenantVM {
  id: string;
  name: string;
  crNumber: string | null;
  createdAt: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | null;
  daysLeft: number | null;
  plan: string | null;
  members: number;
  suspended: boolean;
}

function ActivateDialog({ tenant, plans, onClose }: { tenant: TenantVM; plans: { id: string; name: string }[]; onClose: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(activatePlan.bind(null, tenant.id), null);
  useActionFeedback(state, onClose);
  return (
    <Modal open onClose={onClose} title={`${t.admin.activate} — ${tenant.name}`}>
      <form action={action} className="flex flex-col gap-3.5">
        <Field label={t.admin.plan} htmlFor="act-plan">
          <select id="act-plan" name="planId" className="ui-select">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.billing.choosePlan} htmlFor="act-cycle">
          <select id="act-cycle" name="cycle" className="ui-select">
            <option value="monthly">{t.billing.monthly}</option>
            <option value="yearly">{t.billing.yearly}</option>
          </select>
        </Field>
        <div className="ui-modal__foot" style={{ margin: '0 -20px -20px' }}>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <SubmitButton>{t.admin.activate}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function TenantsTable({ rows, plans }: { rows: TenantVM[]; plans: { id: string; name: string }[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [activating, setActivating] = useState<TenantVM | null>(null);
  const close = useCallback(() => setActivating(null), []);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? t.settings.saved) : (r.error ?? t.common.error), r.ok ? 'ok' : 'err');
    });
  const columns: Column<TenantVM>[] = [
    {
      key: 'name',
      header: t.admin.company,
      cell: (r) => (
        <div className="flex flex-col">
          <b>{r.name}</b>
          <span className="ui-num text-xs text-muted">{r.crNumber ?? '—'}</span>
        </div>
      ),
      sort: (r) => r.name,
      csv: (r) => r.name,
    },
    {
      key: 'status',
      header: t.common.status,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.status ? <Pill tone={r.status === 'active' ? 'green' : r.status === 'trialing' ? 'amber' : 'red'}>{t.billing.status[r.status]}</Pill> : null}
          {r.daysLeft !== null ? <span className="ui-num text-xs text-muted">{r.daysLeft}d</span> : null}
          {r.suspended ? <Pill tone="red">{t.admin.suspend}</Pill> : null}
        </span>
      ),
      sort: (r) => r.status,
      csv: (r) => r.status,
    },
    { key: 'plan', header: t.admin.plan, cell: (r) => r.plan ?? '—', sort: (r) => r.plan, csv: (r) => r.plan },
    { key: 'members', header: t.admin.members, cell: (r) => <span className="ui-num">{r.members}</span>, sort: (r) => r.members, csv: (r) => r.members },
    { key: 'created', header: t.admin.created, cell: (r) => <span className="text-sm">{fmtDate(r.createdAt, locale)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => extendTrial(r.id))}>
            {t.admin.extendTrial}
          </button>
          <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setActivating(r)}>
            {t.admin.activate}
          </button>
          <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" disabled={pending} onClick={() => window.confirm(`${r.suspended ? t.admin.unsuspend : t.admin.suspend}: ${r.name}?`) && run(() => toggleSuspend(r.id))}>
            {r.suspended ? t.admin.unsuspend : t.admin.suspend}
          </button>
        </div>
      ),
    },
  ];
  return (
    <>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} search={(r) => `${r.name} ${r.crNumber ?? ''}`} exportName="tenants" />
      {activating ? <ActivateDialog tenant={activating} plans={plans} onClose={close} /> : null}
    </>
  );
}
