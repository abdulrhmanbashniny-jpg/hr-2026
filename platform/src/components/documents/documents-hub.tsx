'use client';

import { Archive, Briefcase, Download, ExternalLink, FilePlus2, Link2, Pencil, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { deleteBundle, deleteDocument, revokeShareLink, setDocumentStatus } from '@/app/app/documents/actions';
import { Empty, Pill } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ExpiryBadge } from '@/components/ui/expiry';
import { useToast } from '@/components/ui/toast';
import type { ExpiryBucket } from '@/lib/dates';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';
import { BundleForm, DocumentForm, ShareDialog } from './dialogs';

export interface DocumentVM {
  id: string;
  title: string;
  authorityId: string | null;
  authority: string | null;
  referenceNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  expiryDateHijri: string | null;
  alertDays: number[];
  responsibleContactId: string | null;
  responsible: string | null;
  renewalFee: number | null;
  hasFile: boolean;
  fileName: string | null;
  externalUrl: string | null;
  notes: string | null;
  status: 'active' | 'renewal_in_progress' | 'archived';
  bucket: ExpiryBucket;
}
export interface ContactOption {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  telegram: boolean;
}
export interface BundleVM {
  id: string;
  name: string;
  description: string | null;
  documentIds: string[];
}
export interface LinkVM {
  id: string;
  recipient: string | null;
  channel: string | null;
  expiresAt: string;
  accessCount: number;
  titles: string[];
}

export function DocumentsHub(props: {
  docs: DocumentVM[];
  today: string;
  initialBucket: string | null;
  openDocId: string | null;
  authorities: { id: string; name: string }[];
  contacts: ContactOption[];
  bundles: BundleVM[];
  links: LinkVM[];
  canWrite: boolean;
  canShare: boolean;
  channels: { email: boolean; telegram: boolean; whatsappAuto: boolean };
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<DocumentVM | 'new' | null>(null);
  const [sharing, setSharing] = useState<string[] | null>(null);
  const [bundling, setBundling] = useState(false);
  const [pending, start] = useTransition();
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (props.openDocId) {
      const d = props.docs.find((x) => x.id === props.openDocId);
      if (d) setEditing(d);
    }
  }, [props.openDocId, props.docs]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? t.settings.saved) : (r.error ?? t.common.error), r.ok ? 'ok' : 'err');
    });

  const rows = useMemo(() => props.docs.filter((d) => (showArchived ? d.status === 'archived' : d.status !== 'archived')), [props.docs, showArchived]);
  const close = useCallback(() => setEditing(null), []);

  const columns: Column<DocumentVM>[] = [
    {
      key: 'title',
      header: t.documents.docTitle,
      cell: (d) => (
        <div className="flex flex-col gap-0.5">
          <b>{d.title}</b>
          <span className="text-xs text-muted">{d.authority ?? '—'}</span>
          {d.status === 'renewal_in_progress' ? <Pill tone="blue">{t.documents.statusRenewal}</Pill> : null}
        </div>
      ),
      sort: (d) => d.title,
      csv: (d) => d.title,
    },
    { key: 'authority', header: t.documents.authority, cell: () => null, csv: (d) => d.authority, csvOnly: true },
    { key: 'ref', header: t.documents.reference, cell: (d) => <span className="ui-num text-sm">{d.referenceNumber ?? '—'}</span>, csv: (d) => d.referenceNumber, hideSm: true },
    {
      key: 'expiry',
      header: t.documents.expiryDate,
      cell: (d) => (
        <div className="flex flex-col gap-0.5">
          <ExpiryBadge date={d.expiryDate} today={props.today} t={t} locale={locale} showDate />
          {d.expiryDateHijri ? <span className="ui-num text-xs text-muted">{d.expiryDateHijri} هـ</span> : null}
        </div>
      ),
      sort: (d) => d.expiryDate,
      csv: (d) => d.expiryDate,
    },
    { key: 'resp', header: t.documents.responsible, cell: (d) => <span className="text-sm">{d.responsible ?? '—'}</span>, sort: (d) => d.responsible, csv: (d) => d.responsible, hideSm: true },
    {
      key: 'file',
      header: t.documents.file,
      cell: (d) =>
        d.hasFile ? (
          <a className="ui-btn ui-btn--ghost ui-btn--sm" href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener">
            <Download size={16} />
            {t.documents.download}
          </a>
        ) : d.externalUrl ? (
          <a className="ui-btn ui-btn--ghost ui-btn--sm" href={d.externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} />
            {t.share.openLink}
          </a>
        ) : (
          <span className="text-xs text-muted">{t.documents.noFile}</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      cell: (d) => (
        <div className="flex flex-wrap gap-1.5">
          {props.canShare && d.status !== 'archived' ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setSharing([d.id])} aria-label={t.documents.share}>
              <Send size={16} />
            </button>
          ) : null}
          {props.canWrite ? (
            <>
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setEditing(d)} aria-label={t.common.edit}>
                <Pencil size={16} />
              </button>
              {d.status === 'active' ? (
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => setDocumentStatus(d.id, 'renewal_in_progress'))}>
                  {t.documents.markRenewal}
                </button>
              ) : null}
              {d.status === 'archived' ? (
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => setDocumentStatus(d.id, 'active'))} aria-label={t.residents.restore}>
                  <RotateCcw size={16} />
                </button>
              ) : (
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => setDocumentStatus(d.id, 'archived'))} aria-label={t.documents.archive}>
                  <Archive size={16} />
                </button>
              )}
              <button
                type="button"
                className="ui-btn ui-btn--danger ui-btn--sm"
                disabled={pending}
                aria-label={t.common.delete}
                onClick={() => {
                  if (window.confirm(`${t.common.delete}: ${d.title}?`)) run(() => deleteDocument(d.id));
                }}
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <section className="ui-card ui-card--flat">
        <div className="ui-card__head">
          <div className="ui-seg">
            <button type="button" aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>
              {t.documents.statusActive}
            </button>
            <button type="button" aria-pressed={showArchived} onClick={() => setShowArchived(true)}>
              {t.documents.statusArchived}
            </button>
          </div>
          {props.canWrite ? (
            <button type="button" className="ui-btn ui-btn--primary" onClick={() => setEditing('new')}>
              <FilePlus2 size={18} />
              {t.documents.add}
            </button>
          ) : null}
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(d) => d.id}
          search={(d) => `${d.title} ${d.authority ?? ''} ${d.referenceNumber ?? ''} ${d.responsible ?? ''}`}
          filters={(['expired', 'd30', 'd60', 'd90'] as const).map((b) => ({ id: b, label: t.expiry[b], predicate: (d: DocumentVM) => d.bucket === b }))}
          initialFilters={props.initialBucket && props.initialBucket !== 'valid' ? [props.initialBucket] : []}
          selectable={props.canShare}
          selected={selected}
          onSelectedChange={setSelected}
          exportName="documents"
          empty={t.documents.empty}
          toolbar={
            selected.size ? (
              <>
                {props.canShare ? (
                  <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => setSharing([...selected])}>
                    <Send size={16} />
                    {f(t.documents.shareSelected, { n: selected.size })}
                  </button>
                ) : null}
                {props.canWrite ? (
                  <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setBundling(true)}>
                    <Briefcase size={16} />
                    {t.documents.saveBundle}
                  </button>
                ) : null}
                <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setSelected(new Set())} aria-label={t.common.clear}>
                  <X size={16} />
                </button>
              </>
            ) : null
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ui-card ui-card--flat">
          <div className="ui-card__head">
            <h2 className="ui-card__title">{t.documents.bundles}</h2>
          </div>
          {props.bundles.length ? (
            <ul>
              {props.bundles.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <div className="min-w-0">
                    <b className="flex items-center gap-2">
                      <Briefcase size={16} />
                      {b.name}
                    </b>
                    <span className="text-xs text-muted">{b.documentIds.map((id) => props.docs.find((d) => d.id === id)?.title).filter(Boolean).join('، ')}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {props.canShare ? (
                      <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => setSharing(b.documentIds)}>
                        <Send size={16} />
                        {t.documents.sendBundle}
                      </button>
                    ) : null}
                    {props.canWrite ? (
                      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" aria-label={t.documents.deleteBundle} disabled={pending} onClick={() => window.confirm(`${t.documents.deleteBundle}: ${b.name}?`) && run(() => deleteBundle(b.id))}>
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t.documents.bundleEmpty}</Empty>
          )}
        </section>
        <section className="ui-card ui-card--flat">
          <div className="ui-card__head">
            <h2 className="ui-card__title">{t.documents.shareLinks}</h2>
          </div>
          {props.links.length ? (
            <ul>
              {props.links.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                  <div className="min-w-0 text-sm">
                    <b className="flex items-center gap-2">
                      <Link2 size={16} />
                      {l.recipient ?? '—'}
                      {l.channel ? <span className="text-xs text-muted">({l.channel})</span> : null}
                    </b>
                    <span className="block text-xs text-muted">{l.titles.join('، ')}</span>
                    <span className="block text-xs text-muted">
                      {t.documents.expires} {fmtDate(l.expiresAt, locale, true)} · {t.documents.accessCount} {l.accessCount}
                    </span>
                  </div>
                  {props.canShare ? (
                    <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" disabled={pending} onClick={() => run(() => revokeShareLink(l.id))}>
                      {t.documents.revoke}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{t.common.none}</Empty>
          )}
        </section>
      </div>

      {editing ? <DocumentForm doc={editing === 'new' ? null : editing} authorities={props.authorities} contacts={props.contacts} onClose={close} /> : null}
      {sharing ? <ShareDialog docs={props.docs.filter((d) => sharing.includes(d.id))} contacts={props.contacts} channels={props.channels} onClose={() => setSharing(null)} /> : null}
      {bundling ? <BundleForm documentIds={[...selected]} onClose={() => setBundling(false)} onDone={() => setSelected(new Set())} /> : null}
    </>
  );
}
