import { asc, eq, sql } from 'drizzle-orm';
import { KeyRound } from 'lucide-react';
import { db } from '@/db';
import { brands, cities, dealers } from '@/db/schema';
import { toggleDealerAction } from '@/app/admin/actions';
import { ActionButton } from '@/components/admin/action-button';
import { DealerForm } from '@/components/admin/dealer-form';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function DealersPage() {
  await requireStaffPage('dealers:manage');
  const { t, locale } = await getI18n();
  const c = consoleDictionary(locale);
  const [rows, brandRows, cityRows] = await Promise.all([
    db
      .select({
        d: dealers,
        brand: brands.name,
        brandAr: brands.nameAr,
        cityAr: cities.nameAr,
        cityEn: cities.nameEn,
        keys: sql<number>`(select count(*) from dealer_keys k where k.dealer_id = ${dealers.id})`.mapWith(Number),
        approved: sql<number>`(select count(*) from invoices i where i.dealer_id = ${dealers.id} and i.status = 'approved')`.mapWith(Number),
      })
      .from(dealers)
      .leftJoin(brands, eq(brands.id, dealers.brandId))
      .leftJoin(cities, eq(cities.id, dealers.cityId))
      .orderBy(asc(dealers.name)),
    db.select({ id: brands.id, name: brands.name, nameAr: brands.nameAr }).from(brands).orderBy(asc(brands.name)),
    db.select({ id: cities.id, nameAr: cities.nameAr, nameEn: cities.nameEn }).from(cities).orderBy(asc(cities.nameEn)),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.dealers.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">{c.dealers.subtitle}</p>
      </div>
      <Card>
        <DealerForm brands={brandRows} cities={cityRows} />
      </Card>
      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-xs text-muted">
            <tr>
              <th className="p-3 text-start font-medium">{c.dealers.name}</th>
              <th className="p-3 text-start font-medium">{c.dealers.vat}</th>
              <th className="p-3 text-start font-medium">{c.dealers.brand}</th>
              <th className="p-3 text-start font-medium">{c.dealers.city}</th>
              <th className="p-3 text-end font-medium">{c.dealers.keys}</th>
              <th className="p-3 text-end font-medium">{c.dealers.invoices}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.d.id}>
                <td className="p-3">
                  <div className="font-medium text-ink">{r.d.name}</div>
                  {!r.d.isActive && <Badge tone="danger">{t.common.no}</Badge>}
                </td>
                <td className="num p-3 text-ink-2">{r.d.vatNumber}</td>
                <td className="p-3 text-ink-2">{(locale === 'ar' ? r.brandAr : r.brand) ?? '—'}</td>
                <td className="p-3 text-ink-2">{(locale === 'ar' ? r.cityAr : r.cityEn) ?? '—'}</td>
                <td className="p-3 text-end">
                  <span className="inline-flex items-center gap-1 text-ink">
                    <KeyRound className="size-3.5 text-muted" />
                    <span className="num">{r.keys}</span>
                  </span>
                </td>
                <td className="num p-3 text-end text-ink">{r.approved}</td>
                <td className="p-3 text-end">
                  <ActionButton action={toggleDealerAction.bind(null, r.d.id, !r.d.isActive)} variant="ghost">
                    {r.d.isActive ? c.incentives.toggleOff : c.incentives.toggleOn}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
