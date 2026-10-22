import { BarList, KsaMap } from '@/components/admin/charts';
import { Card, CardHeader } from '@/components/ui/card';
import { overview } from '@/lib/admin/stats';
import { requireStaffPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function MapPage() {
  await requireStaffPage();
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const o = await overview();
  const cities = o.cities.map((x) => ({ id: x.id, name: locale === 'ar' ? x.name_ar : x.name_en, lat: x.lat, lng: x.lng, craftsmen: x.craftsmen, active: x.active, invoices: x.invoices }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.map.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.map.subtitle}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <KsaMap cities={cities} labelTop={10} />
        </Card>
        <Card>
          <CardHeader title={c.charts.cities} />
          <BarList rows={cities.filter((x) => x.craftsmen > 0).map((x) => ({ label: x.name, value: x.craftsmen, hint: `${x.active} ${c.map.active}` }))} />
        </Card>
      </div>
    </div>
  );
}
