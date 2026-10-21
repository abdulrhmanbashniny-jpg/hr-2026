import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { driverCards, gosiSubscribers, operatingCards, residents, vehicles } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { f, getI18n } from '@/lib/i18n';
import { TEMPLATES } from '@/lib/imports/templates';
import { RECORD_PATHS, RECORD_PERMISSION, recordDisplayName, type RecordKind } from '@/lib/records/meta';
import { RecordFormPanel, type RecordValues } from './record-form';

const TABLES = { residents, gosi: gosiSubscribers, vehicles, operating_cards: operatingCards, driver_cards: driverCards } as const;

async function canWrite(kind: RecordKind) {
  const s = await requireTenant();
  const ok = can(s.role, RECORD_PERMISSION[kind]) && (!s.tenant.suspended || s.supportMode) && (s.supportMode || (s.subscription?.canWrite ?? true));
  return { s, ok };
}

async function loadValues(kind: RecordKind, tenantId: string, id: string): Promise<RecordValues | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const table = TABLES[kind] as unknown as typeof residents;
  const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.tenantId, tenantId)));
  if (!row) return null;
  const out: RecordValues = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    out[k] = v === null || v === undefined ? null : typeof v === 'boolean' ? v : v instanceof Date ? v.toISOString() : String(v);
  }
  return out;
}

export async function recordFormTitle(kind: RecordKind, id: string | null) {
  const { t, locale } = await getI18n();
  const def = TEMPLATES[kind];
  if (!id) return f(t.records.addTitle, { template: locale === 'ar' ? def.nameAr : def.nameEn });
  const { s } = await canWrite(kind);
  const values = await loadValues(kind, s.tenant.id, id);
  return f(t.records.editTitle, { name: values ? recordDisplayName(kind, values) : '' });
}

/** The add page (id null) or the edit page of one record of `kind`. */
export async function RecordFormPage({ kind, id }: { kind: RecordKind; id: string | null }) {
  const { s, ok } = await canWrite(kind);
  if (!ok) redirect(RECORD_PATHS[kind]);
  const { t, locale } = await getI18n();
  const def = TEMPLATES[kind];
  const template = locale === 'ar' ? def.nameAr : def.nameEn;
  const values = id ? await loadValues(kind, s.tenant.id, id) : {};
  if (!values) notFound();
  return (
    <>
      <PageHead
        eyebrow={template}
        title={id ? f(t.records.editTitle, { name: recordDisplayName(kind, values) }) : f(t.records.addTitle, { template })}
        sub={id ? t.records.editSub : t.records.addSub}
      />
      <RecordFormPanel kind={kind} id={id} initial={values} />
    </>
  );
}
