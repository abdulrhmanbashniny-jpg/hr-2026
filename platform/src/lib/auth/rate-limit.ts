import { and, count, eq, gt, lt } from 'drizzle-orm';
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
  // Occasional clean-up of hits older than a day.
  if (Math.random() < 0.02) await db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, new Date(Date.now() - 86_400_000)));
}

/** Records a hit and reports whether the caller is now over any of the limits. */
export async function consume(rules: { key: string; limit: number; windowMs: number }[]): Promise<boolean> {
  for (const r of rules) if (await isLimited(r.key, r.limit, r.windowMs)) return false;
  await recordHit(...rules.map((r) => r.key));
  return true;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
