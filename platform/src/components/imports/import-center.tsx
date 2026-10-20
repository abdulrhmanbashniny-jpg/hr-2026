'use client';

import { FileSpreadsheet, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Notice, Pill } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';
import { TEMPLATES } from '@/lib/imports/templates';
import { arRecords, enRecords } from '@/lib/rules/text';
import { TEMPLATE_KEYS, type TemplateKey } from '@/lib/imports/types';

export interface ImportHistoryRow {
  id: string;
  template: TemplateKey;
  fileName: string;
  createdAt: string;
  userName: string | null;
  rowCount: number;
  created: number;
  updated: number;
  stale: number;
  conflicts: number;
  missing: number;
  errors: number;
  fileIsStale: boolean;
}

interface UploadResult {
  batchId: string;
  template: TemplateKey;
  counts: { rows: number; created: number; updated: number; stale: number; conflicts: number; missing: number; errors: number };
  fileIsStale: boolean;
  missingDetectionSkipped: boolean;
}

function Dropzone({ template, allowed }: { template: TemplateKey; allowed: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const def = TEMPLATES[template];
  const rec = (n: number) => (locale === 'ar' ? arRecords(n) : enRecords(n));

  const upload = async (file: File) => {
    setError(null);
    setResult(null);
    if (!/\.xlsx$/i.test(file.name)) return setError(t.imports.wrongType);
    if (file.size > 10 * 1024 * 1024) return setError(t.imports.tooLarge);
    setBusy(file.name);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('template', template);
      const res = await fetch('/api/imports', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? t.common.error);
      else {
        setResult(json as UploadResult);
        router.refresh();
      }
    } catch {
      setError(t.common.error);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section id={template} className="ui-card flex flex-col gap-3" style={{ scrollMarginTop: 80 }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="ui-card__title">{locale === 'ar' ? def.nameAr : def.nameEn}</h2>
          <p className="ui-card__sub">{locale === 'ar' ? def.sourceAr : def.sourceEn}</p>
        </div>
        <FileSpreadsheet size={22} aria-hidden />
      </div>
      <div
        className="ui-drop"
        role="button"
        tabIndex={allowed ? 0 : -1}
        aria-disabled={!allowed}
        data-over={over}
        style={allowed ? undefined : { opacity: 0.55, cursor: 'not-allowed' }}
        onClick={() => allowed && !busy && input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && allowed && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (allowed) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (allowed && file) void upload(file);
        }}
      >
        <span className="ui-drop__icon">{busy ? <span className="ui-spinner" /> : <Upload size={22} />}</span>
        <span>
          <b className="block">{busy ? t.imports.uploading : f(t.imports.drop, { name: locale === 'ar' ? def.nameAr : def.nameEn })}</b>
          <span className="ui-hint">{busy ? <span className="ltr">{busy}</span> : allowed ? t.imports.dropHint : t.common.forbidden}</span>
        </span>
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {error ? <Notice tone="red">{error}</Notice> : null}
      {result ? (
        <div className="flex flex-col gap-2">
          {result.fileIsStale ? (
            <Notice tone="amber">
              <b>{f(t.imports.resultStale, { n: rec(result.counts.stale) })}</b>
            </Notice>
          ) : (
            <Notice tone="green">{f(t.imports.resultOk, { updated: rec(result.counts.updated), created: rec(result.counts.created) })}</Notice>
          )}
          {!result.fileIsStale && result.counts.stale ? <Notice tone="amber">{f(t.imports.resultStale, { n: rec(result.counts.stale) })}</Notice> : null}
          {result.counts.conflicts ? <Notice tone="amber">{f(t.imports.resultConflicts, { n: rec(result.counts.conflicts) })}</Notice> : null}
          {result.counts.missing ? <Notice tone="blue">{f(t.imports.resultMissing, { n: rec(result.counts.missing) })}</Notice> : null}
          {result.missingDetectionSkipped ? <Notice tone="blue">{t.imports.resultMissingSkipped}</Notice> : null}
          {result.counts.errors ? <Notice tone="red">{f(t.imports.resultErrors, { n: rec(result.counts.errors) })}</Notice> : null}
          <Link href={`/app/imports/${result.batchId}`} className="ui-btn ui-btn--ghost ui-btn--sm self-start">
            {t.imports.viewReport}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function ImportCenter({ allowed, history }: { allowed: Record<TemplateKey, boolean>; history: ImportHistoryRow[] }) {
  const { t, locale } = useI18n();
  const columns: Column<ImportHistoryRow>[] = [
    { key: 'when', header: t.imports.when, cell: (r) => <span className="whitespace-nowrap text-sm">{fmtDate(r.createdAt, locale, true)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt },
    { key: 'template', header: t.imports.template, cell: (r) => (locale === 'ar' ? TEMPLATES[r.template].nameAr : TEMPLATES[r.template].nameEn), sort: (r) => r.template, csv: (r) => r.template },
    { key: 'file', header: t.imports.file, cell: (r) => <span className="ltr text-sm">{r.fileName}</span>, csv: (r) => r.fileName, hideSm: true },
    { key: 'by', header: t.imports.by, cell: (r) => r.userName ?? '—', csv: (r) => r.userName, hideSm: true },
    {
      key: 'counts',
      header: t.imports.rows,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <Pill tone="gray">{r.rowCount}</Pill>
          {r.created ? <Pill tone="green">+{r.created}</Pill> : null}
          {r.updated ? <Pill tone="blue">↻ {r.updated}</Pill> : null}
          {r.stale ? <Pill tone="amber">{t.imports.stale} {r.stale}</Pill> : null}
          {r.missing ? <Pill tone="amber">{t.imports.missing} {r.missing}</Pill> : null}
          {r.errors ? <Pill tone="red">{t.imports.errors} {r.errors}</Pill> : null}
        </span>
      ),
      csv: (r) => `${r.rowCount}/${r.created}/${r.updated}/${r.stale}/${r.missing}/${r.errors}`,
    },
    { key: 'view', header: '', cell: (r) => <Link href={`/app/imports/${r.id}`} className="ui-btn ui-btn--ghost ui-btn--sm">{t.imports.viewReport}</Link> },
  ];
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATE_KEYS.map((k) => (
          <Dropzone key={k} template={k} allowed={allowed[k]} />
        ))}
      </div>
      <section className="ui-card ui-card--flat">
        <div className="ui-card__head">
          <h2 className="ui-card__title">{t.imports.history}</h2>
        </div>
        <DataTable rows={history} columns={columns} rowKey={(r) => r.id} exportName="imports" pageSize={15} />
      </section>
    </>
  );
}
