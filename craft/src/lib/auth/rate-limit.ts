import { and, count, eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { rateLimitHits } from '@/db/schema';
import { sha256 } from '@/lib/crypto';

/**
 * Rate limits kept in the database, so they hold across every server instance (an in-memory
 * counter resets per instance). Keys are hashed; no address or e-mail is stored in clear.
 */
export async function isLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, sha256(key)), gt(rateLimitHits.createdAt, new Date(Date.now() - windowMs))));
  return n >= limit;
}

export async function recordHit(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  await db.insert(rateLimitHits).values(keys.map((k) => ({ key: sha256(k) })));
  await prune();
}

/** Occasional clean-up of hits older than the longest window in use (30 days, for reviews). */
async function prune() {
  if (Math.random() < 0.02) await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, new Date(Date.now() - 31 * 86_400_000)));
}

/**
 * Checks every limit and records the hit atomically: the keys are locked for the duration of the
 * transaction, so a burst of parallel requests is counted one by one instead of all reading the
 * count from before any of them was recorded.
 */
export async function consume(rules: { key: string; limit: number; windowMs: number }[]): Promise<boolean> {
  if (!rules.length) return true;
  const hashed = rules.map((r) => ({ ...r, hash: sha256(r.key) }));
  const ok = await db.transaction(async (tx) => {
    // Sorted, so two requests sharing keys always lock them in the same order.
    for (const h of [...new Set(hashed.map((r) => r.hash))].sort()) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${h}, 0))`);
    for (const r of hashed) {
      const [{ n }] = await tx
        .select({ n: count() })
        .from(rateLimitHits)
        .where(and(eq(rateLimitHits.key, r.hash), gt(rateLimitHits.createdAt, new Date(Date.now() - r.windowMs))));
      if (n >= r.limit) return false;
    }
    await tx.insert(rateLimitHits).values(hashed.map((r) => ({ key: r.hash })));
    return true;
  });
  if (ok) await prune();
  return ok;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
