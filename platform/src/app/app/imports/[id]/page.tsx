import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, Notice, PageHead, Pill } from '@/components/ui/card';
import { db } from '@/db';
import { importBatches, users } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { f, fmtDate, getI18n } from '@/lib/i18n';
import { fieldLabel, TEMPLATES } from '@/lib/imports/templates';
import { arRecords, enRecords } from '@/lib/rules/text';

export default async function ImportReportPage(props: PageProps<'/app/imports/[id]'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db
    .select({ b: importBatches, userName: users.name })
    .from(importBatches)
    .leftJoin(users, eq(users.id, importBatches.userId))
    .where(and(eq(importBatches.id, id), eq(importBatches.tenantId, s.tenant.id)));
  if (!row) notFound();
  const { b } = row;
  const r = b.report;
  const tpl = TEMPLATES[b.template];
  const label = (field: string) => fieldLabel(b.template, field, locale);
  const List = ({ title, items }: { title: string; items: { key: string; body: React.ReactNode }[] }) =>
    items.length ? (
      <Card title={`${title} (${items.length})`} flat>
        <ul>
          {items.map((it) => (
            <li key={it.key} className="flex flex-wrap items-start justify-between gap-3 border-t px-5 py-2.5 text-sm first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
              {it.body}
            </li>
          ))}
        </ul>
      </Card>
    ) : null;
  return (
    <>
      <PageHead
        title={t.imports.reportTitle}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {locale === 'ar' ? tpl.nameAr : tpl.nameEn} · <span className="ltr">{b.fileName}</span> · {fmtDate(b.createdAt, locale, true)} · {row.userName ?? '—'}
          </span>
        }
      />
      <Notice tone="blue">{f(t.imports.fileDiscarded, { time: fmtDate(b.fileDiscardedAt, locale, true) })}</Notice>
      {b.fileIsStale ? <Notice tone="amber"><b>{f(t.imports.resultStale, { n: locale === 'ar' ? arRecords(b.staleCount) : enRecords(b.staleCount) })}</b></Notice> : null}
      {r.missingDetectionSkipped ? <Notice tone="blue">{t.imports.resultMissingSkipped}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Pill tone="gray">{t.imports.rows}: {b.rowCount}</Pill>
        <Pill tone="green">{t.imports.created}: {b.createdCount}</Pill>
        <Pill tone="blue">{t.imports.updated}: {b.updatedCount}</Pill>
        <Pill tone="gray">{t.imports.unchanged}: {b.unchangedCount}</Pill>
        <Pill tone="amber">{t.imports.stale}: {b.staleCount}</Pill>
        <Pill tone="amber">{t.imports.conflicts}: {b.conflictCount}</Pill>
        <Pill tone="amber">{t.imports.missing}: {b.missingCount}</Pill>
        <Pill tone="red">{t.imports.errors}: {b.errorCount}</Pill>
      </div>
      <Card title={t.imports.columnsMatched}>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap gap-1">{r.matchedColumns.map((c) => <Pill key={c} tone="green">{c}</Pill>)}</div>
          {r.ignoredColumns.length ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted">{t.imports.columnsIgnored}:</span>
              {r.ignoredColumns.map((c, i) => <Pill key={`${c}${i}`} tone="gray">{c}</Pill>)}
            </div>
          ) : null}
          {r.missingOptionalColumns.length ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted">{t.imports.columnsMissing}:</span>
              {r.missingOptionalColumns.map((c) => <Pill key={c} tone="amber">{c}</Pill>)}
            </div>
          ) : null}
        </div>
      </Card>
      <List
        title={t.imports.stale}
        items={r.stale.map((x) => ({
          key: x.key,
          body: (
            <>
              <span><b>{x.label}</b> <span className="ui-num text-muted">{x.key}</span></span>
              <span className="flex flex-col gap-0.5 text-xs">
                {x.dates.map((d) => (
                  <span key={d.field}>
                    {label(d.field)}: {t.imports.fileValue} <span className="ui-num">{d.fileValue ?? '—'}</span> · {t.imports.currentValue} <span className="ui-num">{d.currentValue ?? '—'}</span>
                  </span>
                ))}
              </span>
            </>
          ),
        }))}
      />
      <List
        title={t.imports.conflicts}
        items={r.conflicts.map((x) => ({
          key: x.key,
          body: (
            <>
              <span><b>{x.label}</b> <span className="ui-num text-muted">{x.key}</span></span>
              <span className="text-xs">{x.kept.map((d) => `${label(d.field)}: ${d.currentValue} (${t.imports.fileValue} ${d.fileValue ?? '—'})`).join(' · ')}</span>
            </>
          ),
        }))}
      />
      <List title={t.imports.missing} items={r.missing.map((x) => ({ key: x.key, body: <span><b>{x.label}</b> <span className="ui-num text-muted">{x.key}</span></span> }))} />
      <List
        title={t.imports.updated}
        items={r.updated.map((x) => ({
          key: x.key,
          body: (
            <>
              <span><b>{x.label}</b> <span className="ui-num text-muted">{x.key}</span> {x.restored ? <Pill tone="blue">{t.imports.restored}</Pill> : null}</span>
              <span className="text-xs text-muted">{x.fields.filter((fl) => !fl.endsWith('Hijri')).map(label).join('، ')}</span>
            </>
          ),
        }))}
      />
      <List title={t.imports.created} items={r.created.map((x) => ({ key: x.key, body: <span><b>{x.label}</b> <span className="ui-num text-muted">{x.key}</span></span> }))} />
      <List title={t.imports.errors} items={r.errors.map((x, i) => ({ key: `${i}`, body: <span>{x.message}</span> }))} />
      <List title={locale === 'ar' ? 'تنبيهات القراءة' : 'Parser warnings'} items={r.warnings.map((x, i) => ({ key: `w${i}`, body: <span>{x.message}</span> }))} />
    </>
  );
}
