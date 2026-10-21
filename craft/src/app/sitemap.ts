import { eq } from 'drizzle-orm';
import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { craftsmen, users } from '@/db/schema';
import { env } from '@/lib/env';

export const revalidate = 3600;

/** Public craftsman profiles are discoverable; they carry no phone numbers. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await db
    .select({ code: craftsmen.referralCode, updatedAt: craftsmen.updatedAt })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .where(eq(users.status, 'active'))
    .catch(() => []);
  return [{ url: `${env.appUrl}/`, changeFrequency: 'weekly', priority: 1 }, ...rows.map((r) => ({ url: `${env.appUrl}/c/${r.code}`, lastModified: r.updatedAt, changeFrequency: 'weekly' as const, priority: 0.6 }))];
}
