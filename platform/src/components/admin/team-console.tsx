'use client';

import { Check, Copy, Minus, Plus, UserMinus } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';
import { addStaff, changeStaffRole, removeStaff } from '@/app/admin/team/actions';
import { Avatar } from '@/components/app/topbar';
import { Card, Notice } from '@/components/ui/card';
import { Field, SubmitButton } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/action-result';
import { STAFF_PERMISSIONS, STAFF_ROLES, staffCan, type StaffRole } from '@/lib/admin/staff';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';

export interface StaffVM {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  lastLoginAt: string | null;
  disabled: boolean;
  isSelf: boolean;
}

const ROLE_TONE: Record<StaffRole, string> = { owner: 'ui-pill--blue', admin: 'ui-pill--purple', support: 'ui-pill--green', finance: 'ui-pill--amber' };

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

function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const c = t.console.team;
  const toast = useToast();
  const [role, setRole] = useState<StaffRole>('support');
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof addStaff>> | null, form: FormData) => {
    const r = await addStaff(prev, form);
    if (!r.ok) toast(r.error, 'err');
    else if (!r.data?.link) {
      toast(r.message ?? t.common.saved, 'ok');
      onClose();
    }
    return r;
  }, null);

  const invite = state?.ok ? state.data : null;
  if (invite?.link) {
    return (
      <Modal open onClose={onClose} title={c.invitedTitle}>
        <Notice tone="green">{f(c.invited, { name: invite.name })}</Notice>
        <div className="flex gap-2">
          <input readOnly value={invite.link} className="ui-input ui-input--ltr" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => {
              void navigator.clipboard?.writeText(invite.link!);
              toast(t.common.copied, 'ok');
            }}
          >
            <Copy size={16} />
            {t.common.copy}
          </button>
        </div>
        {invite.emailed ? <span className="ui-hint">{c.inviteEmailed}</span> : null}
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={c.addTitle}>
      <form action={action} className="flex flex-col gap-4">
        <p className="ui-hint">{c.addHint}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={c.email} htmlFor="st-email" required>
            <input id="st-email" name="email" type="email" required className="ui-input ui-input--ltr" autoComplete="off" />
          </Field>
          <Field label={c.name} htmlFor="st-name">
            <input id="st-name" name="name" className="ui-input" />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="ui-label mb-1">{c.role}</legend>
          {STAFF_ROLES.map((r) => (
            <label key={r} className="choice-card" data-checked={role === r}>
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="ui-radio" />
              <span className="min-w-0">
                <b className="block">{c.roles[r]}</b>
                <span className="text-xs text-muted">{c.roleHints[r]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <SubmitButton>
          <Plus size={16} />
          {c.add}
        </SubmitButton>
      </form>
    </Modal>
  );
}

function RoleSelect({ row }: { row: StaffVM }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  return (
    <select
      aria-label={t.console.team.role}
      className="ui-select"
      style={{ minHeight: 34, paddingBlock: 4, fontSize: 13, width: 'auto' }}
      defaultValue={row.role}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        run(async () => {
          const r = await changeStaffRole(row.id, next);
          if (!r.ok) e.target.value = row.role;
          return r;
        });
      }}
    >
      {STAFF_ROLES.map((r) => (
        <option key={r} value={r}>
          {t.console.team.roles[r]}
        </option>
      ))}
    </select>
  );
}

export function TeamConsole({ rows }: { rows: StaffVM[] }) {
  const { t, locale } = useI18n();
  const c = t.console.team;
  const [adding, setAdding] = useState(false);
  const { pending, run } = useRun();

  return (
    <>
      <Card
        title={c.members}
        sub={`${rows.length}`}
        action={
          <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" onClick={() => setAdding(true)}>
            <Plus size={15} />
            {c.add}
          </button>
        }
        flat
      >
        <div className="list">
          {rows.map((r) => (
            <div key={r.id} className="list__row">
              <Avatar name={r.name} />
              <a href={`/admin/users/${r.id}`} className="list__main" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="list__title flex flex-wrap items-center gap-1.5">
                  {r.name}
                  {r.isSelf ? <span className="ui-pill ui-pill--gray">{c.you}</span> : null}
                  {r.disabled ? <span className="ui-pill ui-pill--red">{c.disabled}</span> : null}
                </div>
                <div className="list__sub ltr" style={{ textAlign: 'start' }}>
                  {r.email}
                </div>
              </a>
              <span className="hide-sm text-xs text-muted">
                {c.lastLogin}: {r.lastLoginAt ? fmtDate(r.lastLoginAt, locale, true) : c.never}
              </span>
              {r.isSelf ? <span className={`ui-pill ${ROLE_TONE[r.role]}`}>{c.roles[r.role]}</span> : <RoleSelect row={r} />}
              {r.isSelf ? (
                <span style={{ width: 36 }} />
              ) : (
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={c.remove} title={c.remove} disabled={pending} onClick={() => window.confirm(f(c.removeConfirm, { name: r.name })) && run(() => removeStaff(r.id))}>
                  <UserMinus size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title={c.matrix} sub={c.matrixSub} flat>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th scope="col" />
                {STAFF_ROLES.map((r) => (
                  <th key={r} scope="col" style={{ textAlign: 'center' }}>
                    <span className={`ui-pill ${ROLE_TONE[r]}`}>{c.roles[r]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAFF_PERMISSIONS.map((p) => (
                <tr key={p}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    {c.perms[p]}
                  </th>
                  {STAFF_ROLES.map((r) => (
                    <td key={r} style={{ textAlign: 'center' }}>
                      {staffCan(r, p) ? <Check size={17} style={{ color: 'var(--green-ink)' }} aria-label="✓" /> : <Minus size={15} style={{ color: 'var(--muted)' }} aria-label="—" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {adding ? <AddStaffDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}
