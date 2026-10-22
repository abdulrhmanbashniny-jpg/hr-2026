import { and, asc, eq, inArray } from 'drizzle-orm';
import { unstable_cache, revalidateTag } from 'next/cache';
import { SITE_TAG } from '@/lib/cache-tags';
import { z } from 'zod';
import { db } from '@/db';
import { appSettings, products } from '@/db/schema';
import { ApiError } from '@/lib/http';
import { mediaUrl, storage } from '@/lib/storage';
import { claimUpload } from '@/lib/uploads';

export const PRODUCT_CATEGORIES = ['interior', 'exterior', 'primer', 'waterproofing', 'decorative', 'wood_metal'] as const;
export const CATALOGUE_TAG = 'catalogue';

export const ProductInput = z.object({
  id: z.uuid().optional(),
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  category: z.enum(PRODUCT_CATEGORIES),
  descriptionAr: z.string().trim().max(400).nullable().optional(),
  descriptionEn: z.string().trim().max(400).nullable().optional(),
  finishAr: z.string().trim().max(40).nullable().optional(),
  finishEn: z.string().trim().max(40).nullable().optional(),
  coverageSqmPerLiter: z.number().min(1).max(30).nullable().optional(),
  sizes: z.array(z.string().trim().min(1).max(20)).max(6).default([]),
  swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#102A43'),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
  imageUploadId: z.uuid().nullable().optional(),
});

/** The factory behind the platform: shown in the header, footer, card and WhatsApp messages. */
export const BrandSettings = z.object({
  factoryNameAr: z.string().trim().min(2).max(80),
  factoryNameEn: z.string().trim().min(2).max(80),
  sloganAr: z.string().trim().max(140).default(''),
  sloganEn: z.string().trim().max(140).default(''),
  websiteUrl: z.union([z.url(), z.literal('')]).default(''),
  phone: z.string().trim().max(20).default(''),
});
export type BrandSettings = z.infer<typeof BrandSettings>;

const DEFAULT_BRAND: BrandSettings = {
  factoryNameAr: 'مصنع الدهانات',
  factoryNameEn: 'The Paint Factory',
  sloganAr: 'دهانات سعودية الصنع لكل جدار في المملكة',
  sloganEn: 'Saudi-made paints for every wall in the Kingdom',
  websiteUrl: '',
  phone: '',
};

export const getBrand = unstable_cache(
  async (): Promise<BrandSettings> => {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, 'brand'));
    const parsed = BrandSettings.safeParse(row?.value);
    return parsed.success ? parsed.data : DEFAULT_BRAND;
  },
  ['brand-settings'],
  { tags: [CATALOGUE_TAG, SITE_TAG], revalidate: 3600 },
);

export async function saveBrand(value: BrandSettings, actorId: string) {
  await db
    .insert(appSettings)
    .values({ key: 'brand', value, updatedBy: actorId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
  invalidateCatalogue();
}

export function invalidateCatalogue() {
  try {
    revalidateTag(CATALOGUE_TAG, { expire: 0 });
  } catch {
    // Outside a request: nothing cached.
  }
}

export type Product = typeof products.$inferSelect & { imageUrl: string | null };

const withUrl = (p: typeof products.$inferSelect): Product => ({ ...p, imageUrl: mediaUrl(p.imageKey) });

/** Active products for the public site, cached and invalidated on every catalogue change. */
export const listActiveProducts = unstable_cache(
  async (): Promise<Product[]> => (await db.select().from(products).where(eq(products.isActive, true)).orderBy(asc(products.sortOrder), asc(products.nameEn))).map(withUrl),
  ['active-products'],
  { tags: [CATALOGUE_TAG, SITE_TAG], revalidate: 3600 },
);

export async function listAllProducts(): Promise<Product[]> {
  return (await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.nameEn))).map(withUrl);
}

export async function productsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  return (await db.select().from(products).where(and(inArray(products.id, ids), eq(products.isActive, true)))).map(withUrl);
}

export async function saveProduct(userId: string, input: z.infer<typeof ProductInput>) {
  const { id, imageUploadId, ...values } = input;
  const result = await db.transaction(async (tx) => {
    let imageKey: string | undefined;
    if (imageUploadId) {
      const file = await claimUpload(userId, imageUploadId, 'product', tx);
      if (!file.mime.startsWith('image/')) throw new ApiError('upload_type');
      imageKey = file.key;
    }
    if (id) {
      const [old] = await tx.select({ imageKey: products.imageKey }).from(products).where(eq(products.id, id));
      if (!old) throw new ApiError('not_found');
      await tx
        .update(products)
        .set({ ...values, ...(imageKey ? { imageKey } : {}), updatedAt: new Date() })
        .where(eq(products.id, id));
      return { id, replaced: imageKey && old.imageKey ? old.imageKey : null };
    }
    const [row] = await tx
      .insert(products)
      .values({ ...values, imageKey: imageKey ?? null })
      .returning({ id: products.id });
    return { id: row.id, replaced: null };
  });
  if (result.replaced) await storage().delete(result.replaced).catch(() => undefined);
  invalidateCatalogue();
  return result.id;
}

export async function setProductActive(id: string, active: boolean) {
  const [row] = await db.update(products).set({ isActive: active, updatedAt: new Date() }).where(eq(products.id, id)).returning({ id: products.id });
  if (!row) throw new ApiError('not_found');
  invalidateCatalogue();
}
