'use client';

import { Copy, MessageCircle } from 'lucide-react';
import { useActionState, useCallback, useState } from 'react';
import { createBundle, saveDocument, shareDocumentsAction } from '@/app/app/documents/actions';
import { Notice } from '@/components/ui/card';
import { DateInput } from '@/components/ui/date-input';
import { Field, SubmitButton, useActionFeedback } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import { f } from '@/lib/i18n/format';
import type { ContactOption, DocumentVM } from './documents-hub';

export function DocumentForm({ doc, authorities, contacts, maxFileMb, onClose }: { doc: DocumentVM | null; authorities: { id: string; name: string }[]; contacts: ContactOption[]; maxFileMb: number; onClose: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(saveDocument.bind(null, doc?.id ?? null), null);
  const [authority, setAuthority] = useState(doc?.authorityId ?? '');
  useActionFeedback(state, onClose);
  return (
    <Modal open onClose={onClose} title={doc ? t.documents.editTitle : t.documents.addTitle} wide>
      <form action={action} className="grid gap-3.5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label={t.documents.docTitle} htmlFor="doc-title" required>
            <input id="doc-title" name="title" defaultValue={doc?.title} required minLength={2} className="ui-input" placeholder="السجل التجاري" />
          </Field>
        </div>
        <Field label={t.documents.authority} htmlFor="doc-authority">
          <select id="doc-authority" name="authorityId" value={authority} onChange={(e) => setAuthority(e.target.value)} className="ui-select">
            <option value="">—</option>
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="__new">+ {t.documents.addAuthority}</option>
          </select>
        </Field>
        {authority === '__new' ? (
          <Field label={t.documents.newAuthority} htmlFor="doc-new-authority" required>
            <input id="doc-new-authority" name="newAuthority" required className="ui-input" />
          </Field>
        ) : (
          <Field label={t.documents.reference} htmlFor="doc-ref">
            <input id="doc-ref" name="referenceNumber" defaultValue={doc?.referenceNumber ?? ''} className="ui-input ui-input--ltr" />
          </Field>
        )}
        {authority === '__new' ? (
          <Field label={t.documents.reference} htmlFor="doc-ref">
            <input id="doc-ref" name="referenceNumber" defaultValue={doc?.referenceNumber ?? ''} className="ui-input ui-input--ltr" />
          </Field>
        ) : null}
        <Field label={t.documents.issueDate} htmlFor="doc-issue">
          <DateInput id="doc-issue" name="issueDate" defaultValue={doc?.issueDate} />
        </Field>
        <Field label={t.documents.expiryDate} htmlFor="doc-expiry">
          <DateInput id="doc-expiry" name="expiryDate" defaultValue={doc?.expiryDate} />
        </Field>
        <Field label={t.documents.alertDays} htmlFor="doc-alerts" hint={t.documents.alertDaysHint}>
          <input id="doc-alerts" name="alertDays" defaultValue={(doc?.alertDays ?? [60, 30, 15, 4]).join(', ')} className="ui-input ui-input--ltr ui-num" />
        </Field>
        <Field label={t.documents.responsible} htmlFor="doc-resp">
          <select id="doc-resp" name="responsibleContactId" defaultValue={doc?.responsibleContactId ?? ''} className="ui-select">
            <option value="">{t.documents.noResponsible}</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.documents.renewalFee} htmlFor="doc-fee">
          <input id="doc-fee" name="renewalFee" type="number" min={0} step="1" defaultValue={doc?.renewalFee ?? ''} className="ui-input ui-input--ltr ui-num" />
        </Field>
        <Field label={doc?.hasFile ? t.documents.replaceFile : t.documents.file} htmlFor="doc-file" hint={doc?.fileName ? `${f(t.documents.fileHint, { mb: maxFileMb })} · ${doc.fileName}` : f(t.documents.fileHint, { mb: maxFileMb })}>
          <input id="doc-file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx" className="ui-input" />
        </Field>
        <div className="md:col-span-2">
          <Field label={t.documents.externalUrl} htmlFor="doc-url">
            <input id="doc-url" name="externalUrl" type="url" pattern="https://.*" defaultValue={doc?.externalUrl ?? ''} className="ui-input ui-input--ltr" placeholder="https://" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t.documents.notes} htmlFor="doc-notes">
            <textarea id="doc-notes" name="notes" defaultValue={doc?.notes ?? ''} className="ui-textarea" />
          </Field>
        </div>
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

export function ShareDialog({ docs, contacts, channels, onClose }: { docs: DocumentVM[]; contacts: ContactOption[]; channels: { email: boolean; telegram: boolean; whatsappAuto: boolean }; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, action] = useActionState(shareDocumentsAction, null);
  const [mode, setMode] = useState<'contact' | 'other'>(contacts.length ? 'contact' : 'other');
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [sendMode, setSendMode] = useState<'link' | 'attachment'>('link');
  const contact = contacts.find((c) => c.id === contactId);
  useActionFeedback(state);
  const results = state?.ok ? (state.data?.results ?? []) : [];
  const waLink = results.find((r) => r.waLink)?.waLink;
  const linkUrl = results.find((r) => r.linkUrl)?.linkUrl;
  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard.writeText(text).then(() => toast(t.common.copied, 'ok'));
    },
    [toast, t],
  );

  return (
    <Modal open onClose={onClose} title={f(t.documents.shareTitle, { n: docs.length })} wide>
      {results.length ? (
        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <Notice key={r.channel} tone={r.ok ? 'green' : 'red'}>
              <b>{r.channel}</b> — {r.ok ? t.documents.sent : f(t.documents.channelFailed, { channel: r.channel, error: r.error ?? '' })}
            </Notice>
          ))}
          <div className="flex flex-wrap gap-2">
            {waLink ? (
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--whatsapp">
                <MessageCircle size={18} />
                {t.documents.openWhatsApp}
              </a>
            ) : null}
            {linkUrl ? (
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => copy(linkUrl)}>
                <Copy size={18} />
                {t.documents.copyLink}
              </button>
            ) : null}
            <button type="button" className="ui-btn ui-btn--primary ms-auto" onClick={onClose}>
              {t.common.close}
            </button>
          </div>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-3.5">
          {docs.map((d) => (
            <input key={d.id} type="hidden" name="documentIds" value={d.id} />
          ))}
          <ul className="flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <li key={d.id} className="ui-pill ui-pill--gray">
                {d.title}
              </li>
            ))}
          </ul>
          <div className="ui-seg">
            <button type="button" aria-pressed={mode === 'contact'} onClick={() => setMode('contact')} disabled={!contacts.length}>
              {t.documents.recipientContact}
            </button>
            <button type="button" aria-pressed={mode === 'other'} onClick={() => setMode('other')}>
              {t.documents.recipientOther}
            </button>
          </div>
          {mode === 'contact' ? (
            <Field label={t.documents.recipient} htmlFor="share-contact">
              <select id="share-contact" name="contactId" className="ui-select" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.telegram ? ' · Telegram' : ''}
                    {c.email ? ` · ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t.common.name} htmlFor="share-name">
                <input id="share-name" name="recipientName" required className="ui-input" />
              </Field>
              <Field label={t.common.email} htmlFor="share-email">
                <input id="share-email" name="recipientEmail" type="email" className="ui-input ui-input--ltr" />
              </Field>
              <Field label={t.common.phone} htmlFor="share-phone">
                <input id="share-phone" name="recipientPhone" type="tel" className="ui-input ui-input--ltr" placeholder="05xxxxxxxx" />
              </Field>
            </div>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="ui-label">{t.documents.channels}</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="channels" value="email" className="ui-check" defaultChecked={channels.email} disabled={!channels.email} />
                {t.common.email}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="channels" value="telegram" className="ui-check" disabled={!channels.telegram || (mode === 'contact' ? !contact?.telegram : true)} />
                Telegram
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="channels" value="whatsapp" className="ui-check" defaultChecked={!channels.email} />
                WhatsApp {channels.whatsappAuto ? '' : '(wa.me)'}
              </label>
            </div>
          </fieldset>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t.documents.mode} htmlFor="share-mode">
              <select id="share-mode" name="mode" className="ui-select" value={sendMode} onChange={(e) => setSendMode(e.target.value as 'link' | 'attachment')}>
                <option value="link">{t.documents.modeLink}</option>
                <option value="attachment">{t.documents.modeAttachment}</option>
              </select>
            </Field>
            <Field label={t.documents.linkExpiry} htmlFor="share-exp">
              <select id="share-exp" name="expiresInHours" className="ui-select" defaultValue="24">
                <option value="1">{t.documents.hours1}</option>
                <option value="3">{t.documents.hours3}</option>
                <option value="6">{t.documents.hours6}</option>
                <option value="12">{t.documents.hours12}</option>
                <option value="24">{t.documents.hours24}</option>
                <option value="72">{t.documents.hours72}</option>
                <option value="168">{t.documents.hours168}</option>
                <option value="720">{t.documents.hours720}</option>
                <option value="0">{t.documents.permanent}</option>
              </select>
            </Field>
          </div>
          <Field label={t.documents.message} htmlFor="share-note">
            <textarea id="share-note" name="note" className="ui-textarea" style={{ minHeight: 80 }} />
          </Field>
          <div className="ui-modal__foot" style={{ margin: '0 -20px -20px' }}>
            <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
              {t.common.cancel}
            </button>
            <SubmitButton variant="accent">{t.documents.send}</SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function BundleForm({ documentIds, onClose, onDone }: { documentIds: string[]; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [state, action] = useActionState(createBundle, null);
  useActionFeedback(
    state,
    useCallback(() => {
      onDone();
      onClose();
    }, [onDone, onClose]),
  );
  return (
    <Modal open onClose={onClose} title={t.documents.saveBundle}>
      <form action={action} className="flex flex-col gap-3.5">
        {documentIds.map((id) => (
          <input key={id} type="hidden" name="documentIds" value={id} />
        ))}
        <Field label={t.documents.bundleName} htmlFor="bundle-name" required>
          <input id="bundle-name" name="name" required minLength={2} className="ui-input" placeholder="حقيبة التقديم على المناقصات" />
        </Field>
        <Field label={t.documents.bundleDesc} htmlFor="bundle-desc">
          <input id="bundle-desc" name="description" className="ui-input" />
        </Field>
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
