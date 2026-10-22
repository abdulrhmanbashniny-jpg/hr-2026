import { ok, route } from '@/lib/http';
import { listActiveProducts } from '@/lib/products/service';

/** The factory's active catalogue (public). */
export const GET = route(
  async () => {
    const items = await listActiveProducts();
    return ok(
      items.map((p) => ({ id: p.id, nameAr: p.nameAr, nameEn: p.nameEn, category: p.category, swatch: p.swatch, imageUrl: p.imageUrl, sizes: p.sizes, coverageSqmPerLiter: p.coverageSqmPerLiter })),
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } },
    );
  },
  { csrf: false },
);
