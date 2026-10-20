'use client';

import { Ban, Copy, KeyRound, Link2, LogOut, MonitorSmartphone, ShieldCheck, ShieldOff, Trash2, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { createResetLink, deleteUser, revokeSession, revokeUserSessions, setSuperAdmin, setUserDisabled, setUserPassword, updateUserProfile } from '@/app/admin/users/actions';
import { Avatar } from '@/components/app/topbar';
import { Card, Empty, Notice } from '@/components/ui/card';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/action-result';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';

export interface UserDetailVM {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isSuperAdmin: boolean;
  disabled: boolean;
  isSelf: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  memberships: { tenantId: string; tenantName: string; role: string }[];
  sessions: { id: string; userAgent: string | null; ip: string | null; createdAt: string; current: boolean }[];
  activity: { id: string; summary: string; tenant: string | null; createdAt: string }[];
}

/** "Chrome on macOS" from a user-agent string, without a parsing library. */
function device(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

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

export function UserConsole({ vm }: { vm: UserDetailVM }) {
  const { t, locale } = useI18n();
  const c = t.console.users;
  const toast = useToast();
  const { pending, run } = useRun();
  const [dialog, setDialog] = useState<null | 'password' | 'delete' | 'link'>(null);
  const [link, setLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const [, profileAction] = useFeedbackAction(updateUserProfile.bind(null, vm.id));
  const [, passwordAction] = useFeedbackAction(setUserPassword.bind(null, vm.id), () => setDialog(null));
  const [deleting, startDelete] = useTransition();

  return (
    <>
      <Card>
        <div className="entity-head">
          <Avatar name={vm.name} size="lg" />
          <div className="entity-head__main">
            <span className="entity-head__title">{vm.name}</span>
            <span className="entity-head__meta">
              {vm.disabled ? <span className="ui-pill ui-pill--red ui-pill--dot">{c.disabled}</span> : <span className="ui-pill ui-pill--green ui-pill--dot">{c.active}</span>}
              {vm.isSuperAdmin ? <span className="ui-pill ui-pill--blue">{c.superAdmin}</span> : null}
              <span className="ltr">{vm.email}</span>
              <span>
                {c.lastLogin}: {vm.lastLoginAt ? fmtDate(vm.lastLoginAt, locale, true) : c.never}
              </span>
            </span>
          </div>
        </div>
      </Card>

      <div className="grid-main">
        <div className="stack">
          <Card title={c.profile}>
            <form action={profileAction} className="grid gap-4 md:grid-cols-2">
              <Field label={c.name} htmlFor="u-name" required>
                <input id="u-name" name="name" defaultValue={vm.name} required minLength={2} className="ui-input" />
              </Field>
              <Field label={c.email} htmlFor="u-email" required>
                <input id="u-email" name="email" type="email" defaultValue={vm.email} required className="ui-input ui-input--ltr" />
              </Field>
              <Field label={c.phone} htmlFor="u-phone">
                <input id="u-phone" name="phone" defaultValue={vm.phone ?? ''} className="ui-input ui-input--ltr" />
              </Field>
              <div className="flex items-end">
                <SubmitButton className="w-full">{t.common.save}</SubmitButton>
              </div>
            </form>
          </Card>

          <Card title={c.memberships} flat>
            {vm.memberships.length ? (
              <div className="list">
                {vm.memberships.map((m) => (
                  <Link key={m.tenantId} href={`/admin/tenants/${m.tenantId}`} className="list__row">
                    <Avatar name={m.tenantName} />
                    <div className="list__main">
                      <div className="list__title">{m.tenantName}</div>
                    </div>
                    <span className="ui-pill ui-pill--gray">{t.roles[m.role as 'owner']}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty>{c.noMemberships}</Empty>
            )}
          </Card>

          <Card
            title={c.sessions}
            action={
              vm.sessions.length && !vm.isSelf ? (
                <button type="button" className="ui-btn ui-btn--outline ui-btn--sm" disabled={pending} onClick={() => run(() => revokeUserSessions(vm.id))}>
                  <LogOut size={15} />
                  {c.revokeAll}
                </button>
              ) : null
            }
            flat
          >
            {vm.sessions.length ? (
              <div className="list">
                {vm.sessions.map((s) => (
                  <div key={s.id} className="list__row">
                    <MonitorSmartphone size={18} style={{ color: 'var(--accent)' }} />
                    <div className="list__main">
                      <div className="list__title">{device(s.userAgent)}</div>
                      <div className="list__sub">
                        <span className="ltr">{s.ip ?? '—'}</span> · {c.started} {fmtDate(s.createdAt, locale, true)}
                      </div>
                    </div>
                    {s.current ? null : (
                      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => revokeSession(s.id))}>
                        {c.revoke}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{c.noSessions}</Empty>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title={c.security}>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="ui-btn ui-btn--outline ui-btn--block"
                disabled={pending}
                onClick={async () => {
                  const r = await createResetLink(vm.id);
                  if (r.ok && r.data) {
                    setLink(r.data);
                    setDialog('link');
                  } else if (!r.ok) toast(r.error, 'err');
                }}
              >
                <Link2 size={16} />
                {c.resetLink}
              </button>
              <button type="button" className="ui-btn ui-btn--outline ui-btn--block" onClick={() => setDialog('password')}>
                <KeyRound size={16} />
                {c.setPassword}
              </button>
              {vm.isSelf ? null : (
                <>
                  <button type="button" className="ui-btn ui-btn--outline ui-btn--block" disabled={pending} onClick={() => window.confirm(`${vm.isSuperAdmin ? c.removeAdmin : c.makeAdmin}?`) && run(() => setSuperAdmin(vm.id, !vm.isSuperAdmin))}>
                    {vm.isSuperAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                    {vm.isSuperAdmin ? c.removeAdmin : c.makeAdmin}
                  </button>
                  <button type="button" className={`ui-btn ui-btn--block ${vm.disabled ? 'ui-btn--outline' : 'ui-btn--danger'}`} disabled={pending} onClick={() => window.confirm(`${vm.disabled ? c.enable : c.disable}: ${vm.name}?`) && run(() => setUserDisabled(vm.id, !vm.disabled))}>
                    {vm.disabled ? <UserCheck size={16} /> : <Ban size={16} />}
                    {vm.disabled ? c.enable : c.disable}
                  </button>
                  <button type="button" className="ui-btn ui-btn--danger ui-btn--block" onClick={() => setDialog('delete')}>
                    <Trash2 size={16} />
                    {c.delete}
                  </button>
                </>
              )}
            </div>
          </Card>
          <Card title={t.console.tenants.activity} flat>
            {vm.activity.length ? (
              <div className="timeline py-2">
                {vm.activity.map((a) => (
                  <div key={a.id} className="timeline__item">
                    <span className="timeline__dot" />
                    <div className="min-w-0 text-sm">
                      <div>{a.summary}</div>
                      <div className="text-xs text-muted">{[a.tenant, fmtDate(a.createdAt, locale, true)].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{t.common.noData}</Empty>
            )}
          </Card>
        </div>
      </div>

      {dialog === 'password' ? (
        <Modal open onClose={() => setDialog(null)} title={c.setPassword}>
          <form action={passwordAction} className="flex flex-col gap-4">
            <Field label={c.newPassword} htmlFor="u-pass" hint={t.console.tenants.tempPasswordHint}>
              <input id="u-pass" name="password" type="text" required minLength={10} autoComplete="new-password" className="ui-input ui-input--ltr" />
            </Field>
            <SubmitButton>{c.setPassword}</SubmitButton>
          </form>
        </Modal>
      ) : null}
      {dialog === 'link' && link ? (
        <Modal open onClose={() => setDialog(null)} title={c.resetLinkTitle}>
          <Notice tone="blue">{c.resetLinkHint}</Notice>
          <div className="flex gap-2">
            <input readOnly value={link.link} className="ui-input ui-input--ltr" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => {
                void navigator.clipboard?.writeText(link.link);
                toast(t.common.copied, 'ok');
              }}
            >
              <Copy size={16} />
              {t.common.copy}
            </button>
          </div>
          {link.emailed ? <span className="ui-hint">{c.resetEmailed}</span> : null}
        </Modal>
      ) : null}
      {dialog === 'delete' ? (
        <Modal open onClose={() => setDialog(null)} title={c.delete}>
          <Notice tone="red">{f(c.deleteBody, { name: vm.name })}</Notice>
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            disabled={deleting}
            onClick={() =>
              startDelete(async () => {
                const r = await deleteUser(vm.id);
                if (r && !r.ok) toast(r.error, 'err');
              })
            }
          >
            <Trash2 size={16} />
            {c.delete}
          </button>
        </Modal>
      ) : null}
    </>
  );
}
