import { Factory } from 'lucide-react';
import { BrandForm, ProductGrid } from '@/components/admin/product-admin';
import { PageHeader } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { adminStrings } from '@/lib/i18n/pages/admin';
import { getBrand, listAllProducts } from '@/lib/products/service';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  await requireStaffPage('products:manage');
  const { locale } = await getI18n();
  const s = adminStrings(locale).products;
  const [products, brand] = await Promise.all([listAllProducts(), getBrand()]);
  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <section className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
        <div className="mb-space-md flex items-start gap-space-sm">
          <span className="grid size-10 place-items-center rounded-lg bg-canvas text-primary-container">
            <Factory className="size-5" />
          </span>
          <div>
            <h2 className="text-headline-sm text-primary">{s.brandTitle}</h2>
            <p className="text-body-sm text-on-surface-variant">{s.brandSubtitle}</p>
          </div>
        </div>
        <BrandForm initial={brand} />
      </section>
      <ProductGrid
        products={products.map((p) => ({
          id: p.id,
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          category: p.category,
          descriptionAr: p.descriptionAr,
          descriptionEn: p.descriptionEn,
          finishAr: p.finishAr,
          finishEn: p.finishEn,
          coverageSqmPerLiter: p.coverageSqmPerLiter,
          sizes: p.sizes,
          swatch: p.swatch,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
          isFeatured: p.isFeatured,
          sortOrder: p.sortOrder,
        }))}
      />
    </div>
  );
}
