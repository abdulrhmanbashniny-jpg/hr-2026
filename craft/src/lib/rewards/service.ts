import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { craftsmen, redemptions, rewards, users, wallets } from '@/db/schema';
import { audit } from '@/lib/audit';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { ApiError } from '@/lib/http';
import type { Tier } from '@/lib/incentives/engine';
import { notify } from '@/lib/notifications';
import { normalizeSaudiMobile } from '@/lib/phone';
import { postLedger } from '@/lib/points/ledger';
import { nextReward } from './progress';

const TIER_RANK: Record<Tier, number> = { C: 0, B: 1, A: 2 };

export function tierAllows(tier: Tier, minTier: Tier | null): boolean {
  return !minTier || TIER_RANK[tier] >= TIER_RANK[minTier];
}

export async function catalog(craftsmanId: string, tier: Tier) {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.craftsmanId, craftsmanId));
  const balance = wallet?.balance ?? 0;
  const items = await db
    .select()
    .from(rewards)
    .where(and(eq(rewards.isActive, true), or(isNull(rewards.stock), gt(rewards.stock, 0))))
    .orderBy(asc(rewards.sortOrder), asc(rewards.pointsCost));
  const eligible = items.filter((r) => tierAllows(tier, r.minTier));
  return {
    balance,
    lifetimeEarned: wallet?.lifetimeEarned ?? 0,
    next: nextReward(balance, eligible),
    items: items.map((r) => ({ ...r, affordable: r.pointsCost <= balance, tierAllowed: tierAllows(tier, r.minTier) })),
  };
}

/**
 * Holds the points at once (so they cannot be spent twice) and queues the request for fulfilment.
 * Stock is decremented in the same transaction; a rejected request is refunded in full.
 */
export async function redeem(craftsmanId: string, tier: Tier, rewardId: string, idempotencyKey: string, payoutHandle?: string | null) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(redemptions).where(eq(redemptions.idempotencyKey, `${craftsmanId}:${idempotencyKey}`));
      if (existing) return existing;
      const [r] = await tx.select().from(rewards).where(eq(rewards.id, rewardId)).for('update');
      if (!r || !r.isActive || (r.stock !== null && r.stock <= 0)) throw new ApiError('reward_unavailable');
      if (!tierAllows(tier, r.minTier)) throw new ApiError('tier_required');
      let handle: string | null = null;
      if (r.kind === 'cash_out') {
        handle = payoutHandle ? normalizeSaudiMobile(payoutHandle) : null;
        if (!handle) throw new ApiError('payout_required');
      }
      const [red] = await tx
        .insert(redemptions)
        .values({ craftsmanId, rewardId: r.id, pointsSpent: r.pointsCost, payoutHandle: handle, idempotencyKey: `${craftsmanId}:${idempotencyKey}` })
        .returning();
      await postLedger(tx, { craftsmanId, delta: -r.pointsCost, kind: 'redemption', idempotencyKey: `redeem:${red.id}`, refType: 'redemption', refId: red.id });
      if (r.stock !== null) await tx.update(rewards).set({ stock: sql`${rewards.stock} - 1` }).where(eq(rewards.id, r.id));
      return red;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const [again] = await db.select().from(redemptions).where(eq(redemptions.idempotencyKey, `${craftsmanId}:${idempotencyKey}`));
      if (again) return again;
    }
    throw err;
  }
}

export async function myRedemptions(craftsmanId: string) {
  const rows = await db
    .select({ r: redemptions, reward: rewards })
    .from(redemptions)
    .innerJoin(rewards, eq(rewards.id, redemptions.rewardId))
    .where(eq(redemptions.craftsmanId, craftsmanId))
    .orderBy(desc(redemptions.createdAt))
    .limit(50);
  return rows.map(({ r, reward }) => ({
    id: r.id,
    status: r.status,
    pointsSpent: r.pointsSpent,
    createdAt: r.createdAt,
    fulfilledAt: r.fulfilledAt,
    voucherCode: r.status === 'fulfilled' && r.voucherCodeEnc ? decryptSecret(r.voucherCodeEnc) : null,
    note: r.note,
    reward: { id: reward.id, titleAr: reward.titleAr, titleEn: reward.titleEn, kind: reward.kind },
  }));
}

/** Staff never settle their own reward requests. */
async function assertNotOwn(redemptionId: string, actorId: string) {
  const [row] = await db.select({ userId: craftsmen.userId }).from(redemptions).innerJoin(craftsmen, eq(craftsmen.id, redemptions.craftsmanId)).where(eq(redemptions.id, redemptionId));
  if (row?.userId === actorId) throw new ApiError('self_review', 403);
}

export async function fulfillRedemption(id: string, actorId: string, voucherCode?: string | null, note?: string | null) {
  await assertNotOwn(id, actorId);
  const [red] = await db
    .update(redemptions)
    .set({ status: 'fulfilled', voucherCodeEnc: voucherCode ? encryptSecret(voucherCode.trim()) : null, note: note ?? null, fulfilledBy: actorId, fulfilledAt: new Date() })
    .where(and(eq(redemptions.id, id), eq(redemptions.status, 'requested')))
    .returning();
  if (!red) throw new ApiError('invalid_state');
  await audit(actorId, 'redemption.fulfill', { type: 'redemption', id });
  const [row] = await db
    .select({ userId: users.id, titleAr: rewards.titleAr, titleEn: rewards.titleEn, locale: users.locale })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .innerJoin(rewards, eq(rewards.id, red.rewardId))
    .where(eq(craftsmen.id, red.craftsmanId));
  if (row) await notify(row.userId, 'redemption_fulfilled', { reward: row.locale === 'en' ? row.titleEn : row.titleAr }, '/app/rewards');
}

export async function rejectRedemption(id: string, actorId: string, note?: string | null) {
  await assertNotOwn(id, actorId);
  const red = await db.transaction(async (tx) => {
    const [r] = await tx
      .update(redemptions)
      .set({ status: 'rejected', note: note ?? null, fulfilledBy: actorId, fulfilledAt: new Date() })
      .where(and(eq(redemptions.id, id), eq(redemptions.status, 'requested')))
      .returning();
    if (!r) throw new ApiError('invalid_state');
    await postLedger(tx, { craftsmanId: r.craftsmanId, delta: r.pointsSpent, kind: 'redemption_refund', idempotencyKey: `refund:${r.id}`, refType: 'redemption', refId: r.id, createdBy: actorId });
    await tx.update(rewards).set({ stock: sql`case when ${rewards.stock} is null then null else ${rewards.stock} + 1 end` }).where(eq(rewards.id, r.rewardId));
    await audit(actorId, 'redemption.reject', { type: 'redemption', id }, { note }, tx);
    return r;
  });
  const [c] = await db.select({ userId: craftsmen.userId }).from(craftsmen).where(eq(craftsmen.id, red.craftsmanId));
  if (c) await notify(c.userId, 'redemption_rejected', { points: red.pointsSpent }, '/app/rewards');
}
