import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { brands, cities, craftsmen, portfolioMedia, portfolioProjects, products, trades, users, type ColorUsed } from '@/db/schema';
import type { Tier } from '@/lib/incentives/engine';
import { publicReviews } from '@/lib/reviews/service';
import { mediaUrl } from '@/lib/storage';
import { trustScore, type TrustPart } from '@/lib/trust';
import { craftsmanStats, profileTag } from './service';

export interface PublicMedia {
  id: string;
  kind: 'image' | 'video';
  role: 'before' | 'after' | 'gallery';
  url: string;
  thumbUrl: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  bytes: number;
  mime: string;
  lqip: string | null;
}

export interface PublicProduct {
  id: string;
  nameAr: string;
  nameEn: string;
  swatch: string;
  imageUrl: string | null;
}

export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  projectLabel: string | null;
  contacted: boolean;
  createdAt: string;
}

export interface PublicProject {
  id: string;
  title: string;
  description: string | null;
  city: { nameAr: string; nameEn: string } | null;
  district: string | null;
  completedOn: string | null;
  areaSqm: number | null;
  brand: { name: string; nameAr: string } | null;
  colors: ColorUsed[];
  fieldVerified: boolean;
  warrantyMonths: number | null;
  products: PublicProduct[];
  media: PublicMedia[];
}

export interface PublicProfile {
  id: string;
  code: string;
  displayName: string;
  bio: string | null;
  tier: Tier;
  city: { id: string; nameAr: string; nameEn: string };
  trades: { id: string; nameAr: string; nameEn: string }[];
  yearsExperience: number;
  availability: 'available' | 'busy' | 'away';
  availabilityUntil: string | null;
  warrantyMonths: number;
  avatarUrl: string | null;
  identityVerified: boolean;
  licenseVerified: boolean;
  hasWhatsapp: boolean;
  acceptsCalls: boolean;
  memberSince: string;
  trust: { score: number; parts: TrustPart[] };
  stats: { projects: number; fieldVerified: number; approvedInvoices: number };
  projects: PublicProject[];
  reviews: { items: PublicReview[]; count: number; average: number | null };
}

/** Each craftsman shows up to three works on the public profile. */
const PUBLIC_WORKS = 3;

async function load(code: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({ c: craftsmen, status: users.status, city: cities })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .innerJoin(cities, eq(cities.id, craftsmen.cityId))
    .where(eq(craftsmen.referralCode, code));
  if (!row || row.status !== 'active' || row.c.deletionRequestedAt) return null;
  const c = row.c;

  const [tradeRows, allProjects, stats, reviewSummary] = await Promise.all([
    c.trades.length ? db.select().from(trades).where(inArray(trades.id, c.trades)).orderBy(asc(trades.sortOrder)) : Promise.resolve([]),
    db
      .select({ p: portfolioProjects, city: cities, brand: brands })
      .from(portfolioProjects)
      .leftJoin(cities, eq(cities.id, portfolioProjects.cityId))
      .leftJoin(brands, eq(brands.id, portfolioProjects.brandId))
      .where(and(eq(portfolioProjects.craftsmanId, c.id), eq(portfolioProjects.isPublished, true)))
      .orderBy(desc(portfolioProjects.verification), asc(portfolioProjects.sortOrder), desc(portfolioProjects.completedOn)),
    craftsmanStats(c.id),
    publicReviews(c.id),
  ]);
  const projects = allProjects.slice(0, PUBLIC_WORKS);
  const productIds = [...new Set(projects.flatMap((p) => p.p.productIds))];
  const productRows = productIds.length ? await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.isActive, true))) : [];
  const media = projects.length
    ? await db.select().from(portfolioMedia).where(inArray(portfolioMedia.projectId, projects.map((p) => p.p.id))).orderBy(asc(portfolioMedia.sortOrder))
    : [];

  const trust = trustScore({
    tier: c.tier,
    identityStatus: c.identityStatus,
    licenseStatus: c.licenseStatus,
    projects: stats.projects,
    fieldVerifiedProjects: stats.fieldVerified,
    approvedInvoices: stats.approvedInvoices,
    accountAgeDays: (Date.now() - c.createdAt.getTime()) / 86_400_000,
    yearsExperience: c.yearsExperience,
  });

  return {
    id: c.id,
    code: c.referralCode,
    displayName: c.displayName,
    bio: c.bio,
    tier: c.tier,
    city: { id: row.city.id, nameAr: row.city.nameAr, nameEn: row.city.nameEn },
    trades: tradeRows.map((t) => ({ id: t.id, nameAr: t.nameAr, nameEn: t.nameEn })),
    yearsExperience: c.yearsExperience,
    availability: c.availabilityUntil && c.availabilityUntil < new Date() ? 'available' : c.availability,
    availabilityUntil: c.availabilityUntil?.toISOString() ?? null,
    warrantyMonths: c.warrantyMonths,
    avatarUrl: mediaUrl(c.avatarKey),
    identityVerified: c.identityStatus === 'verified',
    licenseVerified: c.licenseStatus === 'verified',
    hasWhatsapp: !!c.whatsapp,
    acceptsCalls: c.acceptsCalls,
    memberSince: c.createdAt.toISOString(),
    trust,
    stats,
    projects: projects.map(({ p, city, brand }) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      city: city ? { nameAr: city.nameAr, nameEn: city.nameEn } : null,
      district: p.district,
      completedOn: p.completedOn,
      areaSqm: p.areaSqm,
      brand: brand ? { name: brand.name, nameAr: brand.nameAr } : null,
      colors: p.colors,
      fieldVerified: p.verification === 'field_verified',
      warrantyMonths: p.warrantyMonths,
      products: productRows
        .filter((x) => p.productIds.includes(x.id))
        .map((x) => ({ id: x.id, nameAr: x.nameAr, nameEn: x.nameEn, swatch: x.swatch, imageUrl: mediaUrl(x.imageKey) })),
      media: media
        .filter((m) => m.projectId === p.id)
        .map((m) => ({
          id: m.id,
          kind: m.kind,
          role: m.role,
          url: mediaUrl(m.storageKey)!,
          thumbUrl: mediaUrl(m.thumbKey),
          posterUrl: mediaUrl(m.posterKey),
          width: m.width,
          height: m.height,
          durationSec: m.durationSec,
          bytes: m.bytes,
          mime: m.mime,
          lqip: m.lqip,
        })),
    })),
    reviews: { ...reviewSummary, items: reviewSummary.items.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) },
  };
}

/**
 * The public profile, cached in the Next.js data cache for five minutes and tagged so any edit by
 * the craftsman or staff invalidates it at once. The API route adds CDN caching on top.
 */
export function getPublicProfile(code: string): Promise<PublicProfile | null> {
  return unstable_cache(() => load(code), ['public-profile', code], { tags: [profileTag(code)], revalidate: 300 })();
}
