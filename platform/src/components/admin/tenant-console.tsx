'use client';

import { CalendarPlus, LogIn, Megaphone, Pause, Pencil, Play, Plus, Settings2, Trash2, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { sendAnnouncement } from '@/app/admin/messages/actions';
import { addMember, addTenantNote, changeMemberRole, deleteTenant, deleteTenantNote, enterWorkspace, extendTrial, removeMember, toggleSuspend, updateSubscription, updateTenant } from '@/app/admin/tenants/actions';
import { Avatar } from '@/components/app/topbar';
import { Card, Empty, Notice } from '@/components/ui/card';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/action-result';
import type { Role } from '@/lib/auth/rbac';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';
import { StatusPill, type SubStatusKey } from './status';

export interface TenantDetailVM {
  id: string;
  name: string;
  crNumber: string | null;
  createdAt: string;
  suspended: boolean;
  status: SubStatusKey;
  planId: string | null;
  planName: string | null;
  cycle: 'monthly' | 'yearly';
  trialEndsAt: string | null;
  periodEnd: string | null;
  members: { membershipId: string; userId: string; name: string; email: string; role: Role; lastLoginAt: string | null; disabled: boolean }[];
  usage: { label: string; value: number }[];
  payments: { id: string; total: string; status: string; provider: string; createdAt: string; plan: string }[];
  notes: { id: string; body: string; author: string | null; createdAt: string }[];
  activity: { id: string; summary: string; user: string | null; createdAt: string; admin: boolean }[];
  messages: { id: string; title: string; createdAt: string; channels: string[] }[];
  emailEnabled: boolean;
}

const ROLES: Role[] = ['owner', 'general_manager', 'hr_officer', 'fleet_officer', 'viewer'];

function useRun() {
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<ActionResult>) =>
      start(async () => {
        const r = await fn();
        toast(r.ok ? (r.message ?? t.common.saved) : r.error, r.ok ? 'ok' : 'err');
      }),
  };
}

function ExtendDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useI18n();
  const [, action] = useFeedbackAction(extendTrial.bind(null, id), onClose);
  return (
    <Modal open onClose={onClose} title={t.console.tenants.extend}>
      <form action={action} className="flex flex-col gap-4">
        <Field label={t.console.tenants.extendDays} htmlFor="ext-days">
          <input id="ext-days" name="days" type="number" min={1} max={365} defaultValue={7} className="ui-input ui-input--ltr" />
        </Field>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              className="ui-chip"
              onClick={(e) => {
                const input = (e.currentTarget.closest('form') as HTMLFormElement).elements.namedItem('days') as HTMLInputElement;
                input.value = String(d);
              }}
            >
              +{d}
            </button>
          ))}
        </div>
        <SubmitButton>{t.console.tenants.extend}</SubmitButton>
      </form>
    </Modal>
  );
}

function SubscriptionDialog({ vm, plans, onClose }: { vm: TenantDetailVM; plans: { id: string; name: string }[]; onClose: () => void }) {
  const { t } = useI18n();
  const c = t.console.tenants;
  const [, action] = useFeedbackAction(updateSubscription.bind(null, vm.id), onClose);
  return (
    <Modal open onClose={onClose} title={c.manageSub}>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <Field label={c.planField} htmlFor="sub-plan">
          <select id="sub-plan" name="planId" defaultValue={vm.planId ?? ''} className="ui-select">
            <option value="">{c.noPlan}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.cycleField} htmlFor="sub-cycle">
          <select id="sub-cycle" name="cycle" defaultValue={vm.cycle} className="ui-select">
            <option value="monthly">{t.console.cycle.monthly}</option>
            <option value="yearly">{t.console.cycle.yearly}</option>
          </select>
        </Field>
        <Field label={c.statusField} htmlFor="sub-status">
          <select id="sub-status" name="status" defaultValue={vm.status === 'none' ? 'trialing' : vm.status} className="ui-select">
            {(['trialing', 'active', 'past_due', 'canceled', 'expired'] as const).map((s) => (
              <option key={s} value={s}>
                {t.console.status[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.trialEnds} htmlFor="sub-trial">
          <input id="sub-trial" name="trialEndsAt" type="date" defaultValue={vm.trialEndsAt?.slice(0, 10) ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <Field label={c.periodEnd} htmlFor="sub-period">
          <input id="sub-period" name="currentPeriodEnd" type="date" defaultValue={vm.periodEnd?.slice(0, 10) ?? ''} className="ui-input ui-input--ltr" />
        </Field>
        <div className="flex items-end md:col-span-2">
          <SubmitButton className="w-full">{t.common.save}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function EditDialog({ vm, onClose }: { vm: TenantDetailVM; onClose: () => void }) {
  const { t } = useI18n();
  const [, action] = useFeedbackAction(updateTenant.bind(null, vm.id), onClose);
  return (
    <Modal open onClose={onClose} title={t.console.tenants.edit}>
      <form action={action} className="flex flex-col gap-4">
        <Field label={t.console.tenants.companyName} htmlFor="tn-name" required>
          <input id="tn-name" name="name" defaultValue={vm.name} required minLength={2} className="ui-input" />
        </Field>
        <Field label={t.console.tenants.crNumber} htmlFor="tn-cr">
          <input id="tn-cr" name="crNumber" defaultValue={vm.crNumber ?? ''} inputMode="numeric" pattern="\d{10}" className="ui-input ui-input--ltr" />
        </Field>
        <SubmitButton>{t.common.save}</SubmitButton>
      </form>
    </Modal>
  );
}

function DeleteDialog({ vm, onClose }: { vm: TenantDetailVM; onClose: () => void }) {
  const { t } = useI18n();
  const c = t.console.tenants;
  const [typed, setTyped] = useState('');
  const [, action] = useFeedbackAction(deleteTenant.bind(null, vm.id));
  return (
    <Modal open onClose={onClose} title={c.deleteTitle}>
      <form action={action} className="flex flex-col gap-4">
        <Notice tone="red">{f(c.deleteBody, { name: vm.name })}</Notice>
        <Field label={c.deleteConfirm} htmlFor="tn-del">
          <input id="tn-del" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={vm.name} className="ui-input" autoComplete="off" />
        </Field>
        <SubmitButton variant="danger" disabled={typed !== vm.name}>
          <Trash2 size={16} />
          {c.delete}
        </SubmitButton>
      </form>
    </Modal>
  );
}

function MessageDialog({ vm, onClose }: { vm: TenantDetailVM; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.console.messages;
  const [, action] = useFeedbackAction(sendAnnouncement, onClose);
  return (
    <Modal open onClose={onClose} title={`${t.console.tenants.message} · ${vm.name}`}>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="audience" value="tenants" />
        <input type="hidden" name="tenantIds" value={vm.id} />
        <Field label={m.titleField} htmlFor="msg-title" required>
          <input id="msg-title" name="title" required maxLength={160} className="ui-input" />
        </Field>
        <Field label={m.bodyField} htmlFor="msg-body" required>
          <textarea id="msg-body" name="body" required maxLength={4000} className="ui-textarea" />
        </Field>
        <Field label={m.level} htmlFor="msg-level">
          <select id="msg-level" name="level" defaultValue="info" className="ui-select">
            {(['info', 'success', 'warning', 'critical'] as const).map((l) => (
              <option key={l} value={l}>
                {m.levels[l]}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="ui-label mb-1">{m.channels}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="channels" value="in_app" defaultChecked className="ui-check" />
            {m.channelInApp}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="channels" value="banner" defaultChecked className="ui-check" />
            {m.channelBanner}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="channels" value="email" disabled={!vm.emailEnabled} className="ui-check" />
            {m.channelEmail}
          </label>
          {!vm.emailEnabled ? <span className="ui-hint">{m.emailOff}</span> : null}
        </fieldset>
        <SubmitButton>
          <Megaphone size={16} />
          {m.send}
        </SubmitButton>
      </form>
    </Modal>
  );
}

function AddMemberDialog({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const { t } = useI18n();
  const c = t.console.tenants;
  const [, action] = useFeedbackAction(addMember.bind(null, tenantId), onClose);
  return (
    <Modal open onClose={onClose} title={c.addMember}>
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <Field label={c.memberEmail} htmlFor="mb-email" required>
          <input id="mb-email" name="email" type="email" required className="ui-input ui-input--ltr" />
        </Field>
        <Field label={c.memberName} htmlFor="mb-name">
          <input id="mb-name" name="name" className="ui-input" />
        </Field>
        <Field label={c.memberRole} htmlFor="mb-role">
          <select id="mb-role" name="role" defaultValue="viewer" className="ui-select">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={c.tempPassword} htmlFor="mb-pass" hint={c.tempPasswordHint}>
          <input id="mb-pass" name="password" type="text" autoComplete="new-password" className="ui-input ui-input--ltr" />
        </Field>
        <div className="md:col-span-2">
          <SubmitButton className="w-full">
            <Plus size={16} />
            {c.addMember}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function RoleSelect({ membershipId, role }: { membershipId: string; role: Role }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  return (
    <select
      aria-label={t.console.tenants.memberRole}
      className="ui-select"
      style={{ minHeight: 34, paddingBlock: 4, fontSize: 13, width: 'auto' }}
      defaultValue={role}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set('role', e.target.value);
        run(() => changeMemberRole(membershipId, null, fd));
      }}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {t.roles[r]}
        </option>
      ))}
    </select>
  );
}

function NotesCard({ vm }: { vm: TenantDetailVM }) {
  const { t, locale } = useI18n();
  const c = t.console.tenants;
  const [, action] = useFeedbackAction(addTenantNote.bind(null, vm.id));
  const { pending, run } = useRun();
  return (
    <Card title={c.notes} sub={c.notesHint} flat>
      <form action={action} className="flex flex-col gap-2 p-4" key={vm.notes.length}>
        <textarea name="body" required className="ui-textarea" style={{ minHeight: 80 }} placeholder={c.notePlaceholder} />
        <SubmitButton variant="outline" className="self-start">
          <Plus size={16} />
          {c.addNote}
        </SubmitButton>
      </form>
      {vm.notes.length ? (
        <div className="list">
          {vm.notes.map((n) => (
            <div key={n.id} className="list__row" style={{ alignItems: 'flex-start' }}>
              <div className="list__main">
                <div className="whitespace-pre-wrap text-sm">{n.body}</div>
                <div className="list__sub">
                  {n.author ?? '—'} · {fmtDate(n.createdAt, locale, true)}
                </div>
              </div>
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={t.common.delete} disabled={pending} onClick={() => window.confirm(`${t.common.delete}?`) && run(() => deleteTenantNote(n.id))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty>{c.noNotes}</Empty>
      )}
    </Card>
  );
}

export function TenantConsole({ vm, plans }: { vm: TenantDetailVM; plans: { id: string; name: string }[] }) {
  const { t, locale } = useI18n();
  const c = t.console.tenants;
  const [dialog, setDialog] = useState<null | 'extend' | 'sub' | 'edit' | 'delete' | 'message' | 'member'>(null);
  const { pending, run } = useRun();
  const close = () => setDialog(null);

  return (
    <>
      <Card>
        <div className="entity-head">
          <Avatar name={vm.name} size="lg" />
          <div className="entity-head__main">
            <span className="entity-head__title">{vm.name}</span>
            <span className="entity-head__meta">
              <StatusPill status={vm.suspended ? 'suspended' : vm.status} label={vm.suspended ? t.console.status.suspended : t.console.status[vm.status]} />
              {vm.planName ? <span className="ui-pill ui-pill--gray">{`${vm.planName} · ${t.console.cycle[vm.cycle]}`}</span> : null}
              {vm.crNumber ? <span className="ui-num">CR {vm.crNumber}</span> : null}
              <span>{f(c.joined, { date: fmtDate(vm.createdAt, locale) })}</span>
            </span>
          </div>
          <form action={enterWorkspace.bind(null, vm.id)}>
            <button type="submit" className="ui-btn ui-btn--primary" title={c.enterHint}>
              <LogIn size={17} />
              {c.enter}
            </button>
          </form>
        </div>
        <div className="action-bar mt-5">
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => setDialog('message')}>
            <Megaphone size={15} />
            {c.message}
          </button>
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => setDialog('sub')}>
            <Settings2 size={15} />
            {c.manageSub}
          </button>
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => setDialog('extend')}>
            <CalendarPlus size={15} />
            {c.extend}
          </button>
          <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => setDialog('edit')}>
            <Pencil size={15} />
            {c.edit}
          </button>
          <button type="button" className={`ui-btn ui-btn--sm ${vm.suspended ? 'ui-btn--outline' : 'ui-btn--danger'}`} disabled={pending} onClick={() => window.confirm(`${vm.suspended ? c.unsuspend : c.suspend}: ${vm.name}?`) && run(() => toggleSuspend(vm.id))}>
            {vm.suspended ? <Play size={15} /> : <Pause size={15} />}
            {vm.suspended ? c.unsuspend : c.suspend}
          </button>
          <button type="button" className="ui-btn ui-btn--danger ui-btn--sm ms-auto" onClick={() => setDialog('delete')}>
            <Trash2 size={15} />
            {c.delete}
          </button>
        </div>
      </Card>

      <div className="stat-row stat-row--4">
        {vm.usage.map((u) => (
          <div key={u.label} className="stat glass" style={{ background: 'var(--glass-1)' }}>
            <div className="stat__label">{u.label}</div>
            <div className="stat__value">{u.value.toLocaleString('en')}</div>
          </div>
        ))}
      </div>

      <div className="grid-main">
        <div className="stack">
          <Card
            title={c.members}
            sub={`${vm.members.length}`}
            action={
              <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" onClick={() => setDialog('member')}>
                <Plus size={15} />
                {c.addMember}
              </button>
            }
            flat
          >
            <div className="list">
              {vm.members.map((m) => (
                <div key={m.membershipId} className="list__row">
                  <Avatar name={m.name} />
                  <Link href={`/admin/users/${m.userId}`} className="list__main" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="list__title">
                      {m.name} {m.disabled ? <span className="ui-pill ui-pill--red ms-1">{t.console.users.disabled}</span> : null}
                    </div>
                    <div className="list__sub ltr" style={{ textAlign: 'start' }}>
                      {m.email}
                    </div>
                  </Link>
                  <span className="hide-sm text-xs text-muted">{m.lastLoginAt ? fmtDate(m.lastLoginAt, locale, true) : t.console.users.never}</span>
                  <RoleSelect membershipId={m.membershipId} role={m.role} />
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={c.removeMember} title={c.removeMember} disabled={pending} onClick={() => window.confirm(`${c.removeMember}: ${m.name}?`) && run(() => removeMember(m.membershipId))}>
                    <UserMinus size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
          <Card title={c.payments} flat>
            {vm.payments.length ? (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <tbody>
                    {vm.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtDate(p.createdAt, locale)}</td>
                        <td>{p.plan}</td>
                        <td className="ui-num">{p.total}</td>
                        <td className="text-muted">{p.provider}</td>
                        <td>
                          <span className={`ui-pill ui-pill--${p.status === 'paid' ? 'green' : p.status === 'pending' ? 'amber' : 'gray'}`}>{t.console.paymentStatus[p.status as 'paid'] ?? p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>{c.noPayments}</Empty>
            )}
          </Card>
          <Card title={c.activity} flat>
            {vm.activity.length ? (
              <div className="timeline py-2">
                {vm.activity.map((a) => (
                  <div key={a.id} className="timeline__item">
                    <span className="timeline__dot" style={a.admin ? { background: 'var(--accent-2)' } : undefined} />
                    <div className="min-w-0 text-sm">
                      <div>{a.summary}</div>
                      <div className="text-xs text-muted">{[a.user, fmtDate(a.createdAt, locale, true)].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
        </div>
        <div className="stack">
          <Card title={c.subscription}>
            <dl className="dl">
              <dt>{c.statusField}</dt>
              <dd>{t.console.status[vm.status]}</dd>
              <dt>{c.planField}</dt>
              <dd>{vm.planName ?? '—'}</dd>
              <dt>{c.cycleField}</dt>
              <dd>{t.console.cycle[vm.cycle]}</dd>
              <dt>{c.trialEnds}</dt>
              <dd>{fmtDate(vm.trialEndsAt, locale)}</dd>
              <dt>{c.periodEnd}</dt>
              <dd>{fmtDate(vm.periodEnd, locale)}</dd>
            </dl>
            <button type="button" className="ui-btn ui-btn--outline ui-btn--sm mt-4" onClick={() => setDialog('sub')}>
              <Settings2 size={15} />
              {c.manageSub}
            </button>
          </Card>
          <NotesCard vm={vm} />
          <Card title={c.messages} flat>
            {vm.messages.length ? (
              <div className="list">
                {vm.messages.map((m) => (
                  <div key={m.id} className="list__row">
                    <Megaphone size={16} style={{ color: 'var(--accent)' }} />
                    <div className="list__main">
                      <div className="list__title">{m.title}</div>
                      <div className="list__sub">{fmtDate(m.createdAt, locale, true)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{c.noMessages}</Empty>
            )}
          </Card>
        </div>
      </div>

      {dialog === 'extend' ? <ExtendDialog id={vm.id} onClose={close} /> : null}
      {dialog === 'sub' ? <SubscriptionDialog vm={vm} plans={plans} onClose={close} /> : null}
      {dialog === 'edit' ? <EditDialog vm={vm} onClose={close} /> : null}
      {dialog === 'delete' ? <DeleteDialog vm={vm} onClose={close} /> : null}
      {dialog === 'message' ? <MessageDialog vm={vm} onClose={close} /> : null}
      {dialog === 'member' ? <AddMemberDialog tenantId={vm.id} onClose={close} /> : null}
    </>
  );
}
