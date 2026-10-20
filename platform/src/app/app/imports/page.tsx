import { desc, eq } from 'drizzle-orm';
import { Lock } from 'lucide-react';
import { ImportCenter, type ImportHistoryRow } from '@/components/imports/import-center';
import { Card, Notice, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { importBatches, users } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { can, TEMPLATE_PERMISSION } from '@/lib/auth/rbac';
import { getI18n } from '@/lib/i18n';
import { TEMPLATE_KEYS } from '@/lib/imports/types';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.imports.title };
}

export default async function ImportsPage() {
  const s = await requireTenant();
  const { t } = await getI18n();
  const history = await db
    .select({ b: importBatches, userName: users.name })
    .from(importBatches)
    .leftJoin(users, eq(users.id, importBatches.userId))
    .where(eq(importBatches.tenantId, s.tenant.id))
    .orderBy(desc(importBatches.createdAt))
    .limit(100);
  const rows: ImportHistoryRow[] = history.map(({ b, userName }) => ({
    id: b.id,
    template: b.template,
    fileName: b.fileName,
    createdAt: b.createdAt.toISOString(),
    userName,
    rowCount: b.rowCount,
    created: b.createdCount,
    updated: b.updatedCount,
    stale: b.staleCount,
    conflicts: b.conflictCount,
    missing: b.missingCount,
    errors: b.errorCount,
    fileIsStale: b.fileIsStale,
  }));
  const allowed = Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, can(s.role, TEMPLATE_PERMISSION[k]) && (s.subscription?.canWrite ?? true)])) as Record<(typeof TEMPLATE_KEYS)[number], boolean>;
  return (
    <>
      <PageHead title={t.imports.title} sub={t.imports.subtitle} />
      <Notice tone="blue" icon={<Lock size={18} />}>
        {t.imports.privacy}
      </Notice>
      <ImportCenter allowed={allowed} history={rows} />
      <Card title={t.imports.sourcesTitle}>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm">
          {t.imports.sources.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
