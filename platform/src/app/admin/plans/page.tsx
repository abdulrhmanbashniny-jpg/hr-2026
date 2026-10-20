import { asc } from 'drizzle-orm';
import { PlansManager } from '@/components/admin/catalog';
import { Card, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { plans } from '@/db/schema';
import { getI18n } from '@/lib/i18n';
import { requireSuperAdmin } from '@/lib/auth/guards';

export default async function AdminPlans() {
  await requireSuperAdmin('billing:manage');
  const { t } = await getI18n();
  const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder));
  return (
    <>
      <PageHead title={t.admin.plans} />
      <Card flat>
        <PlansManager plans={rows.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
      </Card>
    </>
  );
}
