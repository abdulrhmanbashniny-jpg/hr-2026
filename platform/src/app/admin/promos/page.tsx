import { asc, desc } from 'drizzle-orm';
import { PromosManager } from '@/components/admin/catalog';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { plans, promoCodes } from '@/db/schema';
import { getI18n } from '@/lib/i18n';
import { requireSuperAdmin } from '@/lib/auth/guards';

export default async function AdminPromos() {
  await requireSuperAdmin('billing:manage');
  const { t } = await getI18n();
  const [rows, planRows] = await Promise.all([db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt)), db.select().from(plans).orderBy(asc(plans.sortOrder))]);
  return (
    <>
      <PageHead title={t.admin.promos} />
      <Card flat>
        <PromosManager
          promos={rows.map((p) => ({ ...p, validFrom: p.validFrom?.toISOString() ?? null, validUntil: p.validUntil?.toISOString() ?? null, createdAt: p.createdAt.toISOString() }))}
          planCodes={planRows.map((p) => p.code)}
        />
      </Card>
    </>
  );
}
