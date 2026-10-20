'use client';

import { Bell, CircleAlert, Info, Mail, Megaphone, PanelTop, PartyPopper, Send, Square, TriangleAlert } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { sendAnnouncement, stopAnnouncement } from '@/app/admin/messages/actions';
import { Card, Empty } from '@/components/ui/card';
import { Field, SubmitButton, useFeedbackAction } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { normalizeArabic } from '@/lib/imports/normalize';
import { useI18n } from '@/lib/i18n/client';
import { countOf, f, fmtDate } from '@/lib/i18n/format';

type Level = 'info' | 'success' | 'warning' | 'critical';
type Kind = 'all' | 'trialing' | 'active' | 'expired' | 'plan' | 'tenants';

export interface MessageVM {
  id: string;
  title: string;
  body: string;
  level: Level;
  audience: string;
  channels: string[];
  tenantCount: number;
  userCount: number;
  emailSent: number;
  emailFailed: number;
  createdAt: string;
  author: string | null;
  state: 'live' | 'ended' | 'sent';
}

const TONE = { info: 'blue', success: 'green', warning: 'amber', critical: 'red' } as const;
const ICON = { info: Info, success: PartyPopper, warning: TriangleAlert, critical: CircleAlert } as const;

export function MessagesCenter({ plans, tenants, counts, emailEnabled, history }: { plans: { id: string; name: string }[]; tenants: { id: string; name: string }[]; counts: Record<Exclude<Kind, 'plan' | 'tenants'>, number>; emailEnabled: boolean; history: MessageVM[] }) {
  const { t, locale } = useI18n();
  const m = t.console.messages;
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [level, setLevel] = useState<Level>('info');
  const [kind, setKind] = useState<Kind>('all');
  const [q, setQ] = useState('');
  const [formKey, setFormKey] = useState(0);
  const [, action] = useFeedbackAction(sendAnnouncement, () => {
    setTitle('');
    setBody('');
    setFormKey((k) => k + 1);
  });
  const [pending, start] = useTransition();
  const shownTenants = useMemo(() => {
    const nq = normalizeArabic(q);
    return nq ? tenants.filter((x) => normalizeArabic(x.name).includes(nq)) : tenants;
  }, [q, tenants]);
  const Icon = ICON[level];

  return (
    <div className="grid-main">
      <Card title={m.compose}>
        <form key={formKey} action={action} className="flex flex-col gap-5">
          <Field label={m.titleField} htmlFor="an-title" required>
            <input id="an-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} className="ui-input" />
          </Field>
          <Field label={m.bodyField} htmlFor="an-body" required>
            <textarea id="an-body" name="body" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={4000} className="ui-textarea" />
          </Field>
          <div className="ui-field">
            <span className="ui-label">{m.level}</span>
            <input type="hidden" name="level" value={level} />
            <div className="ui-seg" role="group" aria-label={m.level}>
              {(['info', 'success', 'warning', 'critical'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
                  {m.levels[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={m.audience} htmlFor="an-aud">
              <select id="an-aud" name="audience" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="ui-select">
                {(['all', 'trialing', 'active', 'expired', 'plan', 'tenants'] as const).map((k) => (
                  <option key={k} value={k}>
                    {m.audiences[k]}
                    {k in counts ? ` (${counts[k as keyof typeof counts]})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={m.endsAt} htmlFor="an-ends" hint={m.endsAtHint}>
              <input id="an-ends" name="endsAt" type="date" className="ui-input ui-input--ltr" />
            </Field>
          </div>
          {kind === 'plan' ? (
            <fieldset className="flex flex-wrap gap-3">
              <legend className="ui-label mb-2">{m.choosePlans}</legend>
              {plans.map((p) => (
                <label key={p.id} className="ui-chip">
                  <input type="checkbox" name="planIds" value={p.id} className="ui-check" />
                  {p.name}
                </label>
              ))}
            </fieldset>
          ) : null}
          {kind === 'tenants' ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="ui-label mb-2">{m.chooseTenants}</legend>
              <div className="ui-search">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.console.tenants.search} aria-label={t.common.search} />
              </div>
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-2xl p-2" style={{ background: 'var(--surface-muted)' }}>
                {tenants.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm" style={{ display: shownTenants.includes(x) ? 'flex' : 'none' }}>
                    <input type="checkbox" name="tenantIds" value={x.id} className="ui-check" />
                    {x.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="ui-label mb-2">{m.channels}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="channels" value="banner" defaultChecked className="ui-check" />
              <PanelTop size={16} style={{ color: 'var(--accent)' }} />
              {m.channelBanner}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="channels" value="in_app" defaultChecked className="ui-check" />
              <Bell size={16} style={{ color: 'var(--accent)' }} />
              {m.channelInApp}
            </label>
            <label className="flex items-center gap-2 text-sm" style={emailEnabled ? undefined : { opacity: 0.55 }}>
              <input type="checkbox" name="channels" value="email" disabled={!emailEnabled} className="ui-check" />
              <Mail size={16} style={{ color: 'var(--accent)' }} />
              {m.channelEmail}
            </label>
            {!emailEnabled ? <span className="ui-hint">{m.emailOff}</span> : null}
          </fieldset>
          <Field label={m.link} htmlFor="an-link">
            <input id="an-link" name="link" type="url" placeholder="https://" className="ui-input ui-input--ltr" />
          </Field>
          <SubmitButton className="self-start">
            <Send size={16} />
            {m.send}
          </SubmitButton>
        </form>
      </Card>

      <div className="stack">
        <Card title={m.preview}>
          <div className={`banner banner--${TONE[level]}`} style={{ margin: 0 }}>
            <Icon size={18} className="flex-none" />
            <div className="banner__text">
              <span className="banner__title">{title || m.titleField}</span>
              <span> — {body || m.bodyField}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">{m.from}</p>
        </Card>
        <Card title={m.history} flat>
          {history.length ? (
            <div className="list">
              {history.map((h) => {
                const HIcon = ICON[h.level];
                return (
                  <div key={h.id} className="list__row" style={{ alignItems: 'flex-start' }}>
                    <span className={`ui-pill ui-pill--${TONE[h.level]}`} style={{ padding: 6, marginTop: 2 }}>
                      <HIcon size={14} />
                    </span>
                    <div className="list__main">
                      <div className="list__title">{h.title}</div>
                      <div className="list__sub">
                        {h.audience} · {f(m.recipients, { companies: countOf(h.tenantCount, 'company', locale), users: countOf(h.userCount, 'user', locale) })} · {fmtDate(h.createdAt, locale, true)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {h.channels.includes('banner') ? <span className={`ui-pill ${h.state === 'live' ? 'ui-pill--green ui-pill--dot' : 'ui-pill--gray'}`}>{h.state === 'live' ? m.live : m.ended}</span> : null}
                        {h.channels.includes('in_app') ? (
                          <span className="ui-pill ui-pill--gray">
                            <Bell size={12} />
                          </span>
                        ) : null}
                        {h.channels.includes('email') ? (
                          <span className="ui-pill ui-pill--gray">
                            <Mail size={12} /> {h.emailSent}
                            {h.emailFailed ? ` / ${h.emailFailed}` : ''}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {h.state === 'live' ? (
                      <button
                        type="button"
                        className="ui-btn ui-btn--ghost ui-btn--sm"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await stopAnnouncement(h.id);
                            toast(r.ok ? (r.message ?? '') : r.error, r.ok ? 'ok' : 'err');
                          })
                        }
                      >
                        <Square size={13} />
                        {m.stop}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty icon={<Megaphone size={22} />}>{m.noMessages}</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
