import { and, avg, count, desc, eq, gt, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { craftsmen, leads, reviews, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { invalidateProfile } from '@/lib/craftsmen/service';
import { ApiError } from '@/lib/http';
import type { RequestFingerprint } from '@/lib/signals';

const DAY = 24 * HOUR;

export interface ReviewInput {
  authorName: string;
  rating: number;
  body: string;
  projectLabel?: string | null;
}

/**
 * A client's review, held for moderation. One review per network per craftsman a month, a few a
 * day per network overall, and a "contacted through the platform" mark when the same network
 * opened WhatsApp, a call or an estimate with this craftsman in the last 90 days.
 */
export async function submitReview(code: string, input: ReviewInput, fp: RequestFingerprint) {
  const [c] = await db
    .select({ id: craftsmen.id, status: users.status })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .where(eq(craftsmen.referralCode, code));
  if (!c || c.status !== 'active') throw new ApiError('not_found');
  const who = fp.ipHash ?? fp.deviceId ?? 'anon';
  const allowed = await consume([
    { key: `review:${c.id}:${who}`, limit: 1, windowMs: 30 * DAY },
    { key: `review:any:${who}`, limit: 5, windowMs: DAY },
  ]);
  if (!allowed) throw new ApiError('rate_limited');
  const contacted = fp.ipHash
    ? (
        await db
          .select({ n: count() })
          .from(leads)
          .where(and(eq(leads.craftsmanId, c.id), eq(leads.ipHash, fp.ipHash), inArray(leads.channel, ['whatsapp', 'call', 'estimate']), gt(leads.createdAt, new Date(Date.now() - 90 * DAY))))
      )[0].n > 0
    : false;
  const [row] = await db
    .insert(reviews)
    .values({
      craftsmanId: c.id,
      authorName: input.authorName,
      rating: input.rating,
      body: input.body,
      projectLabel: input.projectLabel || null,
      contactedViaPlatform: contacted,
      ipHash: fp.ipHash,
      deviceId: fp.deviceId,
    })
    .returning({ id: reviews.id });
  return { id: row.id, status: 'pending' as const };
}

export async function moderateReview(actorId: string, reviewId: string, approve: boolean) {
  const [r] = await db
    .update(reviews)
    .set({ status: approve ? 'approved' : 'rejected', moderatedBy: actorId, moderatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
    .returning({ craftsmanId: reviews.craftsmanId });
  if (!r) throw new ApiError('not_found');
  const [c] = await db.select({ code: craftsmen.referralCode }).from(craftsmen).where(eq(craftsmen.id, r.craftsmanId));
  await audit(actorId, approve ? 'review.approve' : 'review.reject', { type: 'review', id: reviewId });
  if (c) invalidateProfile(c.code);
}

export async function publicReviews(craftsmanId: string, limit = 6) {
  const [items, [summary]] = await Promise.all([
    db
      .select({ id: reviews.id, authorName: reviews.authorName, rating: reviews.rating, body: reviews.body, projectLabel: reviews.projectLabel, contacted: reviews.contactedViaPlatform, createdAt: reviews.createdAt })
      .from(reviews)
      .where(and(eq(reviews.craftsmanId, craftsmanId), eq(reviews.status, 'approved')))
      .orderBy(desc(reviews.createdAt))
      .limit(limit),
    db
      .select({ n: count(), avg: avg(reviews.rating) })
      .from(reviews)
      .where(and(eq(reviews.craftsmanId, craftsmanId), eq(reviews.status, 'approved'))),
  ]);
  return { items, count: summary.n, average: summary.avg ? Math.round(Number(summary.avg) * 10) / 10 : null };
}

export async function moderationQueue(status: 'pending' | 'approved' | 'rejected' = 'pending', limit = 60) {
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      projectLabel: reviews.projectLabel,
      contacted: reviews.contactedViaPlatform,
      status: reviews.status,
      createdAt: reviews.createdAt,
      craftsmanId: craftsmen.id,
      craftsmanName: craftsmen.displayName,
      code: craftsmen.referralCode,
    })
    .from(reviews)
    .innerJoin(craftsmen, eq(craftsmen.id, reviews.craftsmanId))
    .where(eq(reviews.status, status))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
