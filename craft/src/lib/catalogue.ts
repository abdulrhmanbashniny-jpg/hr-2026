import { asc } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { brands, cities, regions, trades } from '@/db/schema';

/** Reference data that changes rarely: cached for an hour. */
export const catalogue = unstable_cache(
  async () => {
    const [r, c, tr, b] = await Promise.all([
      db.select().from(regions).orderBy(asc(regions.nameEn)),
      db.select().from(cities).orderBy(asc(cities.nameEn)),
      db.select().from(trades).orderBy(asc(trades.sortOrder)),
      db.select({ id: brands.id, name: brands.name, nameAr: brands.nameAr }).from(brands).orderBy(asc(brands.name)),
    ]);
    return { regions: r, cities: c, trades: tr, brands: b };
  },
  ['catalogue'],
  { revalidate: 3600, tags: ['catalogue'] },
);

export type Catalogue = Awaited<ReturnType<typeof catalogue>>;
