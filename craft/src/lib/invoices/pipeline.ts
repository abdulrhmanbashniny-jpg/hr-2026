import { and, count, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { db, type Tx } from '@/db';
import { isUniqueViolation } from '@/db/errors';
import { cities, craftsmen, dealerKeys, dealers, fraudFlags, incentiveRules, invoices, referrals, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { assessInvoice } from '@/lib/fraud/invoice-risk';
import type { RiskReason } from '@/lib/fraud/types';
import { ApiError } from '@/lib/http';
import { commissionPoints, invoicePoints, referralBonusPoints, resolveIncentive, type IncentiveTarget } from '@/lib/incentives/engine';
import { notify } from '@/lib/notifications';
import { postLedger } from '@/lib/points/ledger';
import { getEconomics } from '@/lib/settings/store';
import { otherAccountsOnDevice, recordSignal, type RequestFingerprint } from '@/lib/signals';
import { storage } from '@/lib/storage';
import { claimUpload } from '@/lib/uploads';
import { decodeZatcaQr, invoiceFingerprint, verifyZatcaSignature } from '@/lib/zatca/qr';
import { extractInvoice, aiConfigured } from './ai';

export interface SubmitInvoiceInput {
  uploadId: string;
  qrPayload?: string | null;
  declaredAmount?: number | null;
  clientFingerprint?: string | null;
}

/** Stores the claim and returns at once; `processInvoice` runs after the response (see the route). */
export async function submitInvoice(userId: string, craftsmanId: string, input: SubmitInvoiceInput, fp: RequestFingerprint) {
  if (!(await consume([{ key: `invoice:${craftsmanId}`, limit: 20, windowMs: 24 * HOUR }]))) throw new ApiError('rate_limited');
  const [c] = await db.select({ cityId: craftsmen.cityId }).from(craftsmen).where(eq(craftsmen.id, craftsmanId));
  const id = await db
    .transaction(async (tx) => {
    const file = await claimUpload(userId, input.uploadId, 'invoice', tx);
    const [dup] = await tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.imageSha256, file.sha256));
    if (dup) throw new ApiError('duplicate_image');
    const [row] = await tx
      .insert(invoices)
      .values({
        craftsmanId,
        status: 'processing',
        imageKey: file.key,
        imageSha256: file.sha256,
        qrPayload: input.qrPayload?.trim().slice(0, 2000) || null,
        declaredAmount: input.declaredAmount ?? null,
        cityId: c?.cityId ?? null,
        ipHash: fp.ipHash,
        deviceId: fp.deviceId,
      })
      .returning({ id: invoices.id });
    await recordSignal(userId, 'invoice', fp, input.clientFingerprint, tx);
    return row.id;
    })
    .catch((err) => {
      if (isUniqueViolation(err)) throw new ApiError('duplicate_image');
      throw err;
    });
  return { id, status: 'processing' as const };
}

async function activeRules(tx: Tx | typeof db, target: IncentiveTarget) {
  return tx.select().from(incentiveRules).where(and(eq(incentiveRules.isActive, true), eq(incentiveRules.target, target)));
}

async function regionOf(tx: Tx | typeof db, cityId: string | null): Promise<string | null> {
  if (!cityId) return null;
  const [c] = await tx.select({ region: cities.regionCode }).from(cities).where(eq(cities.id, cityId));
  return c?.region ?? null;
}

/**
 * Reads the QR code and the photo, scores the risk and decides. Safe to run more than once: it only
 * acts on invoices still in `processing`.
 */
export async function processInvoice(invoiceId: string): Promise<void> {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv || inv.status !== 'processing') return;
  try {
    const eco = await getEconomics();
    const [owner] = await db
      .select({ craftsman: craftsmen, userId: users.id })
      .from(craftsmen)
      .innerJoin(users, eq(users.id, craftsmen.userId))
      .where(eq(craftsmen.id, inv.craftsmanId));

    // 1. ZATCA QR
    const decoded = inv.qrPayload ? decodeZatcaQr(inv.qrPayload) : null;
    const qr = decoded?.ok ? decoded.qr : null;
    const sig = qr ? verifyZatcaSignature(qr) : null;

    // 2. AI reading of the photo
    let extraction = null;
    if (aiConfigured()) {
      const file = await storage().get(inv.imageKey);
      if (file) extraction = await extractInvoice(file.body, file.mime);
    }

    // 3. Dealer and key
    const vat = qr?.vatNumber ?? extraction?.sellerVat ?? null;
    const [dealer] = vat ? await db.select().from(dealers).where(eq(dealers.vatNumber, vat)) : [];
    let keyKnown: boolean | null = null;
    if (sig?.verdict === 'valid' && sig.publicKeyB64) {
      keyKnown = dealer ? !!(await db.select({ id: dealerKeys.id }).from(dealerKeys).where(and(eq(dealerKeys.dealerId, dealer.id), eq(dealerKeys.publicKey, sig.publicKeyB64))))[0] : false;
    }

    // 4. Facts the decision is based on
    const total = qr?.total ?? extraction?.total ?? inv.declaredAmount ?? null;
    const vatAmount = qr?.vat ?? extraction?.vat ?? null;
    const issuedIso = qr?.timestamp ?? extraction?.issuedAt ?? null;
    const issuedAt = issuedIso && !Number.isNaN(new Date(issuedIso).getTime()) ? new Date(issuedIso) : null;

    const dayStart = new Date(Date.now() - 24 * HOUR);
    const [{ today }] = await db
      .select({ today: count() })
      .from(invoices)
      .where(and(eq(invoices.craftsmanId, inv.craftsmanId), gte(invoices.createdAt, dayStart), ne(invoices.id, inv.id)));
    let dealerP95: number | null = null;
    if (dealer) {
      const [p] = await db.execute<{ p95: string | null; n: string }>(
        sql`select percentile_cont(0.95) within group (order by total_amount) as p95, count(*) as n from invoices where dealer_id = ${dealer.id} and status = 'approved'`,
      ).then((r) => r.rows);
      if (p && Number(p.n) >= 20 && p.p95) dealerP95 = Number(p.p95);
    }

    const risk = assessInvoice(
      {
        now: new Date(),
        qr: {
          payloadPresent: !!inv.qrPayload,
          decoded: !!qr,
          phase: qr?.phase ?? null,
          signature: sig?.verdict ?? 'absent',
          keyKnown,
          vatNumber: qr?.vatNumber ?? null,
          total: qr?.total ?? null,
        },
        dealer: { found: !!dealer, active: !!dealer?.isActive },
        extraction,
        aiConfigured: aiConfigured(),
        declaredAmount: inv.declaredAmount,
        issuedAt,
        total,
        dealerP95,
        invoicesToday: today,
        accountAgeHours: (Date.now() - owner.craftsman.createdAt.getTime()) / 3_600_000,
        sharedDeviceAccounts: await otherAccountsOnDevice(owner.userId, inv.deviceId),
      },
      eco,
    );

    // 5. One genuine invoice, one claim
    const fingerprint = vat ? invoiceFingerprint({ vatNumber: vat, invoiceHash: qr?.invoiceHash, timestamp: issuedAt?.toISOString() ?? null, total }) : null;
    let decision = risk.decision;
    const reasons: RiskReason[] = [...risk.reasons];
    if (fingerprint) {
      const [dup] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.fingerprint, fingerprint), ne(invoices.id, inv.id)));
      if (dup) {
        decision = 'reject';
        reasons.unshift({ code: 'duplicate_invoice', weight: 0, detail: { invoice: dup.id.slice(0, 8) } });
      }
    }

    const status = decision === 'reject' ? 'rejected' : decision === 'flag' ? 'flagged' : 'pending';
    await db
      .update(invoices)
      .set({
        status: decision === 'auto_approve' ? 'pending' : status,
        dealerId: dealer?.id ?? null,
        qrPhase: qr?.phase ?? null,
        qrSignature: sig ? sig.verdict : 'absent',
        qrPublicKey: sig?.publicKeyB64 ?? null,
        sellerName: qr?.sellerName ?? extraction?.sellerName ?? null,
        sellerVat: vat,
        invoiceNumber: extraction?.invoiceNumber ?? null,
        issuedAt,
        totalAmount: total,
        vatAmount,
        extraction,
        fingerprint: decision === 'reject' && reasons[0]?.code === 'duplicate_invoice' ? null : fingerprint,
        riskScore: risk.score,
        riskReasons: reasons,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, inv.id), eq(invoices.status, 'processing')));

    if (decision === 'flag') {
      await db.insert(fraudFlags).values({ subjectType: 'invoice', subjectId: inv.id, craftsmanId: inv.craftsmanId, rule: reasons[0]?.code ?? 'risk', score: risk.score, details: { reasons } });
    }
    if (decision === 'auto_approve') {
      await approveInvoice(inv.id, null);
      return;
    }
    if (decision === 'reject') {
      const code = reasons.find((r) => r.code === 'duplicate_invoice' || r.code === risk.rejectReason)?.code ?? reasons[0]?.code;
      await notify(owner.userId, 'invoice_rejected', (t) => ({ reason: code ? t.risk[code] : '' }), '/app/invoices');
      return;
    }
    await notify(owner.userId, 'invoice_review', {}, '/app/invoices');
  } catch (err) {
    // Two accounts processing the same receipt at the same moment: the unique fingerprint decides.
    if (isUniqueViolation(err)) {
      await db
        .update(invoices)
        .set({ status: 'rejected', fingerprint: null, riskReasons: [{ code: 'duplicate_invoice', weight: 0 }], updatedAt: new Date() })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.status, 'processing')));
      return;
    }
    console.error('[invoice] processing failed', invoiceId, err);
    await db
      .update(invoices)
      .set({ status: 'pending', processingError: String(err instanceof Error ? err.message : err).slice(0, 500), updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.status, 'processing')));
  }
}

/** Re-runs invoices stuck in `processing` (a crashed function, a deploy mid-flight). */
export async function sweepStuckInvoices(): Promise<number> {
  const stuck = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.status, 'processing'), lt(invoices.createdAt, new Date(Date.now() - 3 * 60_000))))
    .limit(50);
  for (const s of stuck) await processInvoice(s.id);
  return stuck.length;
}

interface Payout {
  userId: string;
  kind: 'invoice_approved' | 'welcome_bonus' | 'referral_bonus' | 'commission';
  vars: Record<string, string | number>;
}

/**
 * Approves an invoice and pays everything that follows from it, in one transaction: the invoice
 * points, the welcome and referral bonuses when this is the craftsman's first approved invoice, and
 * the level 1 and level 2 commissions. Every posting is idempotent, so approving twice pays once.
 */
export async function approveInvoice(invoiceId: string, actorId: string | null, note?: string) {
  const eco = await getEconomics();
  const payouts: Payout[] = [];
  await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update');
    if (!inv) throw new ApiError('not_found');
    if (inv.status === 'approved') return;
    if (!['pending', 'flagged'].includes(inv.status)) throw new ApiError('invalid_state');
    if (!inv.totalAmount || inv.totalAmount <= 0) throw new ApiError('invalid_state');

    const [me] = await tx.select({ c: craftsmen, userId: users.id, userStatus: users.status }).from(craftsmen).innerJoin(users, eq(users.id, craftsmen.userId)).where(eq(craftsmen.id, inv.craftsmanId));
    const regionCode = await regionOf(tx, me.c.cityId);
    const at = inv.issuedAt ?? inv.createdAt;
    const incentive = resolveIncentive(await activeRules(tx, 'invoice'), { target: 'invoice', cityId: me.c.cityId, regionCode, at }, eco.maxMultiplier);
    const pts = invoicePoints({ total: inv.totalAmount, vat: inv.vatAmount, tier: me.c.tier, incentive }, eco);

    if (pts.points > 0) {
      await postLedger(tx, { craftsmanId: me.c.id, delta: pts.points, kind: 'invoice', idempotencyKey: `invoice:${inv.id}`, refType: 'invoice', refId: inv.id, createdBy: actorId });
      payouts.push({ userId: me.userId, kind: 'invoice_approved', vars: { points: pts.points } });
    }
    await tx
      .update(invoices)
      .set({
        status: 'approved',
        basePoints: pts.basePoints,
        pointsAwarded: pts.points,
        ruleSnapshot: { ...incentive, tierMultiplier: pts.tierMultiplier },
        reviewedBy: actorId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, inv.id));

    // A person approved an invoice signed by a key we had not seen at this dealer: trust the key from now on.
    if (actorId && inv.dealerId && inv.qrSignature === 'valid' && inv.qrPublicKey) {
      await tx.insert(dealerKeys).values({ dealerId: inv.dealerId, publicKey: inv.qrPublicKey, approvedBy: actorId }).onConflictDoNothing();
    }

    // First approved invoice: the craftsman is activated, and their referrer earns the referral bonus.
    if (!me.c.activatedAt) {
      await tx.update(craftsmen).set({ activatedAt: new Date() }).where(eq(craftsmen.id, me.c.id));
      if (eco.welcomeBonus > 0 && me.c.referredById) {
        await postLedger(tx, { craftsmanId: me.c.id, delta: eco.welcomeBonus, kind: 'welcome_bonus', idempotencyKey: `welcome:${me.c.id}`, refType: 'craftsman', refId: me.c.id });
        payouts.push({ userId: me.userId, kind: 'welcome_bonus', vars: { points: eco.welcomeBonus } });
      }
      const [ref] = await tx.select().from(referrals).where(eq(referrals.refereeId, me.c.id));
      if (ref && ref.status === 'pending') {
        await tx.update(referrals).set({ status: 'activated', activatedAt: new Date() }).where(eq(referrals.id, ref.id));
        const payout = await payReferralBonus(tx, ref.id, ref.referrerId, me.c, regionCode, eco);
        if (payout) payouts.push(payout);
      }
    }

    // Commissions: level 1 is the referrer, level 2 the referrer's referrer. Both links must be active.
    const l1 = await activeReferrerOf(tx, me.c.id);
    if (l1) {
      const inc = resolveIncentive(await activeRules(tx, 'commission'), { target: 'commission', cityId: me.c.cityId, regionCode, at }, eco.maxMultiplier);
      const p1 = commissionPoints(pts.basePoints, 1, eco, inc);
      if (p1 > 0) {
        await postLedger(tx, { craftsmanId: l1.craftsmanId, delta: p1, kind: 'commission_l1', idempotencyKey: `commission:l1:${inv.id}`, refType: 'invoice', refId: inv.id });
        payouts.push({ userId: l1.userId, kind: 'commission', vars: { points: p1, name: me.c.displayName } });
      }
      const l2 = await activeReferrerOf(tx, l1.craftsmanId);
      if (l2 && l2.craftsmanId !== me.c.id) {
        const p2 = commissionPoints(pts.basePoints, 2, eco, inc);
        if (p2 > 0) {
          await postLedger(tx, { craftsmanId: l2.craftsmanId, delta: p2, kind: 'commission_l2', idempotencyKey: `commission:l2:${inv.id}`, refType: 'invoice', refId: inv.id });
          payouts.push({ userId: l2.userId, kind: 'commission', vars: { points: p2, name: me.c.displayName } });
        }
      }
    }
    if (actorId) await audit(actorId, 'invoice.approve', { type: 'invoice', id: inv.id }, { points: pts.points, note }, tx);
  });
  for (const p of payouts) await notify(p.userId, p.kind, p.vars, p.kind === 'commission' || p.kind === 'referral_bonus' ? '/app/referrals' : '/app');
}

async function activeReferrerOf(tx: Tx, craftsmanId: string): Promise<{ craftsmanId: string; userId: string } | null> {
  const [row] = await tx
    .select({ craftsmanId: referrals.referrerId, userId: users.id })
    .from(referrals)
    .innerJoin(craftsmen, eq(craftsmen.id, referrals.referrerId))
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .where(and(eq(referrals.refereeId, craftsmanId), eq(referrals.status, 'activated'), eq(users.status, 'active')));
  return row ?? null;
}

/** Pays the referrer once the referee is activated. Used on first approval and when staff release a held referral. */
export async function payReferralBonus(
  tx: Tx,
  referralId: string,
  referrerId: string,
  referee: { id: string; cityId: string; displayName: string },
  regionCode: string | null,
  eco: Awaited<ReturnType<typeof getEconomics>>,
): Promise<Payout | null> {
  const inc = resolveIncentive(await activeRules(tx, 'referral_bonus'), { target: 'referral_bonus', cityId: referee.cityId, regionCode, at: new Date() }, eco.maxMultiplier);
  const points = referralBonusPoints(eco, inc);
  if (points <= 0) return null;
  const res = await postLedger(tx, { craftsmanId: referrerId, delta: points, kind: 'referral_bonus', idempotencyKey: `referral_bonus:${referralId}`, refType: 'referral', refId: referralId });
  if (!res.applied) return null;
  const [r] = await tx.select({ userId: craftsmen.userId }).from(craftsmen).where(eq(craftsmen.id, referrerId));
  return { userId: r.userId, kind: 'referral_bonus', vars: { points, name: referee.displayName } };
}

export async function rejectInvoice(invoiceId: string, actorId: string, note?: string) {
  const [inv] = await db
    .update(invoices)
    .set({ status: 'rejected', reviewedBy: actorId, reviewedAt: new Date(), reviewNote: note ?? null, fingerprint: null, updatedAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), inArray(invoices.status, ['pending', 'flagged'])))
    .returning({ craftsmanId: invoices.craftsmanId });
  if (!inv) throw new ApiError('invalid_state');
  await audit(actorId, 'invoice.reject', { type: 'invoice', id: invoiceId }, { note });
  const [c] = await db.select({ userId: craftsmen.userId }).from(craftsmen).where(eq(craftsmen.id, inv.craftsmanId));
  if (c) await notify(c.userId, 'invoice_rejected', { reason: note ?? '' }, '/app/invoices');
}
