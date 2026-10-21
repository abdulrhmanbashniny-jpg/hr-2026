import { eq, sql } from 'drizzle-orm';
import type { Tx } from '@/db';
import { pointsLedger, wallets } from '@/db/schema';
import { ApiError } from '@/lib/http';

export type LedgerKind = (typeof pointsLedger.$inferInsert)['kind'];

export interface Posting {
  craftsmanId: string;
  delta: number;
  kind: LedgerKind;
  /** Same key → same row. Replays (retries, double clicks, re-run jobs) never pay twice. */
  idempotencyKey: string;
  refType?: string;
  refId?: string;
  note?: string;
  createdBy?: string | null;
}

export interface PostingResult {
  entryId: string;
  balanceAfter: number;
  /** False when the key had already been posted and nothing changed. */
  applied: boolean;
}

/**
 * Posts one journal row and moves the cached balance, inside the caller's transaction. The wallet
 * row is locked first, so concurrent postings for one craftsman serialise and `balance_after` is
 * exact; the CHECK (balance >= 0) constraint is the last line of defence against overspending.
 */
export async function postLedger(tx: Tx, p: Posting): Promise<PostingResult> {
  if (!Number.isInteger(p.delta) || p.delta === 0) throw new Error(`Invalid ledger delta ${p.delta}`);

  await tx.insert(wallets).values({ craftsmanId: p.craftsmanId }).onConflictDoNothing();
  const [wallet] = await tx.select().from(wallets).where(eq(wallets.craftsmanId, p.craftsmanId)).for('update');

  const [existing] = await tx.select().from(pointsLedger).where(eq(pointsLedger.idempotencyKey, p.idempotencyKey));
  if (existing) return { entryId: existing.id, balanceAfter: existing.balanceAfter, applied: false };

  const balanceAfter = wallet.balance + p.delta;
  if (balanceAfter < 0) throw new ApiError('insufficient_points');

  const [entry] = await tx
    .insert(pointsLedger)
    .values({
      craftsmanId: p.craftsmanId,
      delta: p.delta,
      kind: p.kind,
      refType: p.refType ?? null,
      refId: p.refId ?? null,
      idempotencyKey: p.idempotencyKey,
      balanceAfter,
      note: p.note ?? null,
      createdBy: p.createdBy ?? null,
    })
    .returning({ id: pointsLedger.id });

  const spending = p.kind === 'redemption';
  await tx
    .update(wallets)
    .set({
      balance: balanceAfter,
      lifetimeEarned: p.delta > 0 && p.kind !== 'redemption_refund' ? sql`${wallets.lifetimeEarned} + ${p.delta}` : wallets.lifetimeEarned,
      lifetimeRedeemed: spending ? sql`${wallets.lifetimeRedeemed} + ${-p.delta}` : p.kind === 'redemption_refund' ? sql`${wallets.lifetimeRedeemed} - ${p.delta}` : wallets.lifetimeRedeemed,
      updatedAt: new Date(),
    })
    .where(eq(wallets.craftsmanId, p.craftsmanId));

  return { entryId: entry.id, balanceAfter, applied: true };
}
