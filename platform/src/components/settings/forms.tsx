'use client';

import { Copy, Link2, Pencil, Plus, Send, Trash2, Unlink, UserPlus } from 'lucide-react';
import { useActionState, useCallback, useState, useTransition } from 'react';
import {
  changeRole,
  deleteContact,
  inviteMember,
  regenerateTelegramLink,
  removeMember,
  revokeInvitation,
  saveContact,
  testSmtp,
  unlinkTelegram,
  updateCompany,
  updateRules,
  updateSmtp,
  updateWhatsapp,
} from '@/app/app/settings/actions';
import { Notice, Pill } from '@/components/ui/card';
import { Field, SubmitButton, useActionFeedback } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import type { Permission, Role } from '@/lib/auth/rbac';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';
import type { TenantSettings } from '@/lib/settings';

const ROLE_LIST: Role[] = ['owner', 'general_manager', 'hr_officer', 'fleet_officer', 'viewer'];
const MODULES = ['residents', 'gosi', 'fleet', 'operating_cards', 'driver_cards', 'documents', 'cross'] as const;

function useRun() {
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? t.settings.saved) : (r.error ?? t.common.error), r.ok ? 'ok' : 'err');
    });
  return { pending, run };
}

export function CompanyForm({ name, crNumber, canEdit }: { name: string; crNumber: string | null; canEdit: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateCompany, null);
  useActionFeedback(state);
  return (
    <form action={action} className="grid max-w-2xl gap-3.5 md:grid-cols-2">
      <Field label={t.settings.companyName} htmlFor="co-name" required>
        <input id="co-name" name="name" defaultValue={name} required disabled={!canEdit} className="ui-input" />
      </Field>
      <Field label={t.settings.crNumber} htmlFor="co-cr">
        <input id="co-cr" name="crNumber" defaultValue={crNumber ?? ''} pattern="\d{10}" disabled={!canEdit} className="ui-input ui-input--ltr" />
      </Field>
      {canEdit ? (
        <div className="md:col-span-2">
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

interface MemberVM {
  id: string;
  role: Role;
  userId: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
}

export function MembersPanel({ members, invites, currentUserId, currentRole, canManage, matrix }: { members: MemberVM[]; invites: { id: string; email: string; role: Role; expiresAt: string }[]; currentUserId: string; currentRole: Role; canManage: boolean; matrix: { role: Role; permissions: Permission[] }[] }) {
  const { t, locale } = useI18n();
  const { pending, run } = useRun();
  const [state, action] = useActionState(inviteMember, null);
  useActionFeedback(state);
  const allPerms = [...new Set(matrix.flatMap((m) => m.permissions))];
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="ui-card__title">{t.settings.membersTitle}</h2>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>{t.common.name}</th>
                <th>{t.common.email}</th>
                <th>{t.common.role}</th>
                <th className="hide-sm">{t.common.lastUpdated}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.name}</b> {m.userId === currentUserId ? <Pill tone="gray">{t.settings.you}</Pill> : null}
                  </td>
                  <td className="ltr text-sm">{m.email}</td>
                  <td>
                    {canManage && (currentRole === 'owner' || m.role !== 'owner') ? (
                      <select className="ui-select" style={{ minHeight: 36, padding: '4px 10px' }} defaultValue={m.role} aria-label={t.settings.changeRole} disabled={pending} onChange={(e) => run(() => changeRole(m.id, e.target.value as Role))}>
                        {ROLE_LIST.filter((r) => currentRole === 'owner' || r !== 'owner').map((r) => (
                          <option key={r} value={r}>
                            {t.roles[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      t.roles[m.role]
                    )}
                  </td>
                  <td className="hide-sm text-sm text-muted">{m.lastLoginAt ? fmtDate(m.lastLoginAt, locale, true) : '—'}</td>
                  <td>
                    {canManage && m.userId !== currentUserId ? (
                      <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" disabled={pending} onClick={() => window.confirm(`${t.settings.removeMember}: ${m.name}?`) && run(() => removeMember(m.id))}>
                        {t.settings.removeMember}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <section className="flex flex-col gap-3">
          <h2 className="ui-card__title">{t.settings.invite}</h2>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <Field label={t.settings.inviteEmail} htmlFor="inv-email">
              <input id="inv-email" name="email" type="email" required className="ui-input ui-input--ltr" style={{ minWidth: 260 }} />
            </Field>
            <Field label={t.common.role} htmlFor="inv-role">
              <select id="inv-role" name="role" className="ui-select" defaultValue="hr_officer">
                {ROLE_LIST.filter((r) => currentRole === 'owner' || r !== 'owner').map((r) => (
                  <option key={r} value={r}>
                    {t.roles[r]}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton>
              <UserPlus size={18} />
              {t.settings.invite}
            </SubmitButton>
          </form>
          {state?.ok && state.data?.url ? (
            <Notice tone="green">
              {t.settings.inviteSent} <span className="ltr break-all text-xs">{state.data.url}</span>
            </Notice>
          ) : null}
          {invites.length ? (
            <div>
              <h3 className="ui-label mb-2">{t.settings.pendingInvites}</h3>
              <ul className="flex flex-col gap-2">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="ltr">{i.email}</span> · {t.roles[i.role]} · {t.documents.expires} {fmtDate(i.expiresAt, locale)}
                    </span>
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => revokeInvitation(i.id))}>
                      {t.documents.revoke}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="ui-card__title">{t.settings.rolesMatrix}</h2>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th />
                {matrix.map((m) => (
                  <th key={m.role}>{t.roles[m.role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPerms.map((p) => (
                <tr key={p}>
                  <td>
                    <code className="ui-num text-xs">{p}</code>
                  </td>
                  {matrix.map((m) => (
                    <td key={m.role} className="text-center">
                      {m.permissions.includes(p) ? '✓' : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface ContactVM {
  id: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  modules: string[];
  canRequestDocuments: boolean;
  receiveWeeklyReport: boolean;
  telegramUsername: string | null;
  telegramLinked: boolean;
  telegramLink: string | null;
}

function ContactForm({ contact, onClose }: { contact: ContactVM | null; onClose: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveContact.bind(null, contact?.id ?? null), null);
  useActionFeedback(state, onClose);
  return (
    <Modal open onClose={onClose} title={contact ? contact.name : t.settings.addContact}>
      <form action={action} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 md:grid-cols-2">
          <Field label={t.common.name} htmlFor="c-name" required>
            <input id="c-name" name="name" defaultValue={contact?.name} required className="ui-input" />
          </Field>
          <Field label={t.settings.jobTitle} htmlFor="c-job">
            <input id="c-job" name="jobTitle" defaultValue={contact?.jobTitle ?? ''} className="ui-input" />
          </Field>
          <Field label={t.common.phone} htmlFor="c-phone">
            <input id="c-phone" name="phone" type="tel" defaultValue={contact?.phone ?? ''} className="ui-input ui-input--ltr" placeholder="05xxxxxxxx" />
          </Field>
          <Field label={t.common.email} htmlFor="c-email">
            <input id="c-email" name="email" type="email" defaultValue={contact?.email ?? ''} className="ui-input ui-input--ltr" />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="ui-label">{t.settings.modules}</legend>
          <span className="ui-hint">{t.settings.modulesHint}</span>
          <div className="flex flex-wrap gap-3">
            {MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="modules" value={m} defaultChecked={contact?.modules.includes(m)} className="ui-check" />
                {t.modules[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="canRequestDocuments" defaultChecked={contact?.canRequestDocuments} className="ui-check" />
          {t.settings.canRequestDocuments}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="receiveWeeklyReport" defaultChecked={contact?.receiveWeeklyReport} className="ui-check" />
          {t.settings.weeklyReport}
        </label>
        <div className="ui-modal__foot" style={{ margin: '0 -20px -20px' }}>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function ContactsPanel({ contacts, canManage, botConfigured }: { contacts: ContactVM[]; canManage: boolean; botConfigured: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const { pending, run } = useRun();
  const [editing, setEditing] = useState<ContactVM | 'new' | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => toast(t.common.copied, 'ok'));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="ui-card__title">{t.settings.contactsTitle}</h2>
          <p className="ui-card__sub">{t.settings.contactsSub}</p>
        </div>
        {canManage ? (
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => setEditing('new')}>
            <Plus size={18} />
            {t.settings.addContact}
          </button>
        ) : null}
      </div>
      {!botConfigured ? <Notice tone="amber">{t.settings.botNotConfigured}</Notice> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {contacts.map((c) => (
          <div key={c.id} className="ui-card flex flex-col gap-2" style={{ padding: 18 }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <b>{c.name}</b>
                <div className="text-sm text-muted">{c.jobTitle ?? ''}</div>
              </div>
              {canManage ? (
                <div className="flex gap-1">
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={t.common.edit} onClick={() => setEditing(c)}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" aria-label={t.common.delete} disabled={pending} onClick={() => window.confirm(`${t.common.delete}: ${c.name}?`) && run(() => deleteContact(c.id))}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-1 text-sm">
              {c.phone ? <span className="ltr">{c.phone}</span> : null}
              {c.email ? <span className="ltr">{c.email}</span> : null}
            </div>
            <div className="flex flex-wrap gap-1">
              {(c.modules.length ? c.modules : ['__all']).map((m) => (
                <Pill key={m} tone="gray">
                  {m === '__all' ? t.common.all : t.modules[m as (typeof MODULES)[number]]}
                </Pill>
              ))}
              {c.canRequestDocuments ? <Pill tone="blue">/docs</Pill> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2" style={{ borderColor: 'var(--line-soft)' }}>
              <span className="text-sm">{t.settings.telegram}:</span>
              {c.telegramLinked ? <Pill tone="green">{f(t.settings.telegramLinked, { username: c.telegramUsername ?? '' })}</Pill> : <Pill tone="amber">{t.settings.telegramNotLinked}</Pill>}
              {canManage && botConfigured ? (
                c.telegramLinked ? (
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => unlinkTelegram(c.id))}>
                    <Unlink size={16} />
                    {t.settings.unlinkTelegram}
                  </button>
                ) : c.telegramLink ? (
                  <>
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => copy(c.telegramLink!)} title={t.settings.telegramLinkHint}>
                      <Copy size={16} />
                      {t.settings.telegramLink}
                    </button>
                    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => regenerateTelegramLink(c.id))}>
                      <Link2 size={16} />
                      {t.settings.regenerateLink}
                    </button>
                  </>
                ) : null
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {editing ? <ContactForm contact={editing === 'new' ? null : editing} onClose={close} /> : null}
    </div>
  );
}

export function ChannelsForms({
  smtp,
  whatsapp,
  telegram,
  canEdit,
}: {
  smtp: TenantSettings['smtp'] & { hasPassword: boolean };
  whatsapp: TenantSettings['whatsapp'] & { hasToken: boolean; hasAuth: boolean };
  telegram: { configured: boolean; username: string };
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  const [smtpState, smtpAction] = useActionState(updateSmtp, null);
  const [waState, waAction] = useActionState(updateWhatsapp, null);
  const [waMode, setWaMode] = useState(whatsapp.mode);
  useActionFeedback(smtpState);
  useActionFeedback(waState);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="ui-card__title">{t.settings.telegramTitle}</h2>
        <p className="ui-card__sub">{t.settings.telegramSub}</p>
        {telegram.configured ? (
          <Notice tone="green">
            {t.settings.botUsername}: <span className="ltr">@{telegram.username}</span>
          </Notice>
        ) : (
          <Notice tone="amber">{t.settings.botNotConfigured}</Notice>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="ui-card__title">{t.settings.smtpTitle}</h2>
        <p className="ui-card__sub">{t.settings.smtpSub}</p>
        <form action={smtpAction} className="grid max-w-3xl gap-3.5 md:grid-cols-2">
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" name="smtpEnabled" defaultChecked={smtp.enabled} disabled={!canEdit} className="ui-check" />
            {t.settings.smtpEnabled}
          </label>
          <Field label={t.settings.smtpHost} htmlFor="smtp-host">
            <input id="smtp-host" name="smtpHost" defaultValue={smtp.host} disabled={!canEdit} className="ui-input ui-input--ltr" placeholder="smtp.office365.com" />
          </Field>
          <Field label={t.settings.smtpPort} htmlFor="smtp-port">
            <input id="smtp-port" name="smtpPort" type="number" defaultValue={smtp.port} disabled={!canEdit} className="ui-input ui-input--ltr" />
          </Field>
          <Field label={t.settings.smtpUser} htmlFor="smtp-user">
            <input id="smtp-user" name="smtpUser" defaultValue={smtp.user} disabled={!canEdit} className="ui-input ui-input--ltr" autoComplete="off" />
          </Field>
          <Field label={t.settings.smtpPassword} htmlFor="smtp-pass" hint={smtp.hasPassword ? t.settings.smtpPasswordKeep : undefined}>
            <input id="smtp-pass" name="smtpPassword" type="password" disabled={!canEdit} className="ui-input ui-input--ltr" autoComplete="new-password" />
          </Field>
          <Field label={t.settings.smtpFromName} htmlFor="smtp-from-name">
            <input id="smtp-from-name" name="smtpFromName" defaultValue={smtp.fromName} disabled={!canEdit} className="ui-input" />
          </Field>
          <Field label={t.settings.smtpFromEmail} htmlFor="smtp-from">
            <input id="smtp-from" name="smtpFromEmail" type="email" defaultValue={smtp.fromEmail} disabled={!canEdit} className="ui-input ui-input--ltr" />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="smtpSecure" defaultChecked={smtp.secure} disabled={!canEdit} className="ui-check" />
            {t.settings.smtpSecure}
          </label>
          {canEdit ? (
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <SubmitButton>{t.common.save}</SubmitButton>
              <button type="button" className="ui-btn ui-btn--ghost" disabled={pending} onClick={() => run(() => testSmtp())}>
                <Send size={18} />
                {t.settings.testSmtp}
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="ui-card__title">{t.settings.whatsappTitle}</h2>
        <p className="ui-card__sub">{t.settings.whatsappSub}</p>
        <form action={waAction} className="grid max-w-3xl gap-3.5 md:grid-cols-2">
          <Field label={t.settings.waMode} htmlFor="wa-mode">
            <select id="wa-mode" name="waMode" value={waMode} onChange={(e) => setWaMode(e.target.value as typeof waMode)} disabled={!canEdit} className="ui-select">
              <option value="deeplink">{t.settings.waDeeplink}</option>
              <option value="cloud_api">{t.settings.waCloud}</option>
              <option value="webhook">{t.settings.waWebhook}</option>
            </select>
          </Field>
          <span />
          {waMode === 'cloud_api' ? (
            <>
              <Field label={t.settings.waPhoneId} htmlFor="wa-phone">
                <input id="wa-phone" name="waPhoneId" defaultValue={whatsapp.cloudPhoneNumberId} disabled={!canEdit} className="ui-input ui-input--ltr" />
              </Field>
              <Field label={t.settings.waToken} htmlFor="wa-token" hint={whatsapp.hasToken ? t.settings.smtpPasswordKeep : undefined}>
                <input id="wa-token" name="waToken" type="password" disabled={!canEdit} className="ui-input ui-input--ltr" autoComplete="off" />
              </Field>
              <Field label={t.settings.waTemplate} htmlFor="wa-template">
                <input id="wa-template" name="waTemplate" defaultValue={whatsapp.cloudTemplateName} disabled={!canEdit} className="ui-input ui-input--ltr" />
              </Field>
              <Field label={t.settings.waTemplateLang} htmlFor="wa-lang">
                <input id="wa-lang" name="waTemplateLang" defaultValue={whatsapp.cloudTemplateLang} disabled={!canEdit} className="ui-input ui-input--ltr" />
              </Field>
            </>
          ) : null}
          {waMode === 'webhook' ? (
            <>
              <Field label={t.settings.waWebhookUrl} htmlFor="wa-url">
                <input id="wa-url" name="waWebhookUrl" type="url" defaultValue={whatsapp.webhookUrl} disabled={!canEdit} className="ui-input ui-input--ltr" placeholder="https://" />
              </Field>
              <Field label={t.settings.waWebhookAuth} htmlFor="wa-auth" hint={whatsapp.hasAuth ? t.settings.smtpPasswordKeep : undefined}>
                <input id="wa-auth" name="waWebhookAuth" type="password" disabled={!canEdit} className="ui-input ui-input--ltr" autoComplete="off" placeholder="Bearer …" />
              </Field>
            </>
          ) : null}
          {canEdit ? (
            <div className="md:col-span-2">
              <SubmitButton>{t.common.save}</SubmitButton>
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}

export function RulesForm({ settings, canEdit }: { settings: TenantSettings; canEdit: boolean }) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateRules, null);
  useActionFeedback(state);
  const num = (name: string, label: string, value: number, step = '1') => (
    <Field label={label} htmlFor={`r-${name}`}>
      <input id={`r-${name}`} name={name} type="number" step={step} min={0} defaultValue={value} disabled={!canEdit} className="ui-input ui-input--ltr ui-num" />
    </Field>
  );
  const list = (name: string, label: string, value: string[]) => (
    <Field label={label} htmlFor={`r-${name}`} hint={t.settings.listHint}>
      <textarea id={`r-${name}`} name={name} defaultValue={value.join('\n')} disabled={!canEdit} className="ui-textarea" />
    </Field>
  );
  return (
    <form action={action} className="flex flex-col gap-8">
      <section className="grid gap-3.5 md:grid-cols-3">
        <h2 className="ui-card__title md:col-span-3">{t.settings.rulesTitle}</h2>
        <Field label={t.settings.templateAlertDays} htmlFor="r-days" hint={t.documents.alertDaysHint}>
          <input id="r-days" name="templateAlertDays" defaultValue={settings.templateAlertDays.join(', ')} disabled={!canEdit} className="ui-input ui-input--ltr ui-num" />
        </Field>
        <Field label={t.settings.probationDays} htmlFor="r-prob">
          <select id="r-prob" name="probationDays" defaultValue={String(settings.probationDays)} disabled={!canEdit} className="ui-select">
            <option value="90">90</option>
            <option value="180">180</option>
          </select>
        </Field>
        {num('probationAlertLeadDays', t.settings.probationLead, settings.probationAlertLeadDays)}
        {num('saudiMinContributoryWage', t.settings.minWage, settings.saudiMinContributoryWage)}
        {num('seniorAge', t.settings.seniorAge, settings.seniorAge)}
        {num('maxVehiclesPerUser', t.settings.maxVehiclesPerUser, settings.maxVehiclesPerUser)}
        <Field label={t.settings.weeklyDay} htmlFor="r-week">
          <select id="r-week" name="weeklyReportDay" defaultValue={String(settings.weeklyReportDay)} disabled={!canEdit} className="ui-select">
            {t.settings.weekdays.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.settings.eosBasis} htmlFor="r-eos">
          <select id="r-eos" name="eosWageBasis" defaultValue={settings.eosWageBasis} disabled={!canEdit} className="ui-select">
            <option value="basic_housing">{t.settings.eosBasicHousing}</option>
            <option value="total">{t.settings.eosTotal}</option>
          </select>
        </Field>
      </section>
      <section className="grid gap-3.5 md:grid-cols-2">
        {list('heavyDriverOccupations', t.settings.heavyOccupations, settings.heavyDriverOccupations)}
        {list('excludedDriverOccupations', t.settings.excludedOccupations, settings.excludedDriverOccupations)}
        {list('operatingCardRegistrationTypes', t.settings.opRegistrationTypes, settings.operatingCardRegistrationTypes)}
        {list('lightVehicleKeywords', t.settings.lightKeywords, settings.lightVehicleKeywords)}
      </section>
      <section className="grid gap-3.5 md:grid-cols-3">
        <h2 className="ui-card__title md:col-span-3">{t.settings.feesTitle}</h2>
        {num('fee_iqamaRenewal', t.settings.feeIqama, settings.fees.iqamaRenewal)}
        {num('fee_workPermit', t.settings.feeWorkPermit, settings.fees.workPermit)}
        {num('fee_operatingCard', t.settings.feeOpCard, settings.fees.operatingCard)}
        {num('fee_driverCard', t.settings.feeDriverCard, settings.fees.driverCard)}
        {num('fee_inspection', t.settings.feeInspection, settings.fees.inspection)}
        {num('fee_vehicleLicense', t.settings.feeLicense, settings.fees.vehicleLicense)}
      </section>
      <section className="grid gap-3.5 md:grid-cols-3">
        <h2 className="ui-card__title md:col-span-3">{t.settings.gosiTitle}</h2>
        <p className="ui-hint md:col-span-3">{t.settings.gosiNote}</p>
        {num('gosi_saudiEmployerPct', t.settings.gosiSaudiEmployer, settings.gosi.saudiEmployerPct, '0.01')}
        {num('gosi_saudiEmployeePct', t.settings.gosiSaudiEmployee, settings.gosi.saudiEmployeePct, '0.01')}
        {num('gosi_nonSaudiEmployerPct', t.settings.gosiNonSaudi, settings.gosi.nonSaudiEmployerPct, '0.01')}
        {num('gosi_saudiNewEmployerPct', t.settings.gosiNewEmployer, settings.gosi.saudiNewEmployerPct, '0.01')}
        {num('gosi_saudiNewEmployeePct', t.settings.gosiNewEmployee, settings.gosi.saudiNewEmployeePct, '0.01')}
        {num('gosi_maxContributoryWage', t.settings.gosiMax, settings.gosi.maxContributoryWage)}
      </section>
      {canEdit ? (
        <div>
          <SubmitButton>{t.common.save}</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
