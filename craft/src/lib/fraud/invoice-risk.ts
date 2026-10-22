import type { InvoiceExtraction } from '@/lib/invoices/types';
import type { Economics } from '@/lib/settings/economics';
import type { SignatureVerdict } from '@/lib/zatca/qr';
import { totalRisk, type RiskAssessment, type RiskCode, type RiskReason } from './types';

export interface InvoiceRiskInput {
  now: Date;
  qr: {
    payloadPresent: boolean;
    decoded: boolean;
    phase: 1 | 2 | null;
    signature: SignatureVerdict | 'absent';
    /** Whether the signing key is one of the dealer's known keys; null when unsigned. */
    keyKnown: boolean | null;
    vatNumber: string | null;
    total: number | null;
  };
  /** hasKeys: the dealer has issued Phase 2 (signed) invoices before. */
  dealer: { found: boolean; active: boolean; hasKeys?: boolean };
  extraction: InvoiceExtraction | null;
  aiConfigured: boolean;
  declaredAmount: number | null;
  issuedAt: Date | null;
  /** The issue date in the QR (tag 3, not covered by the signature) and the one read from the photo. */
  qrIssuedAt?: Date | null;
  aiIssuedAt?: Date | null;
  /** The total the decision is based on (QR, else AI, else declared). */
  total: number | null;
  /** 95th percentile of this dealer's approved totals, when enough history exists. */
  dealerP95: number | null;
  invoicesToday: number;
  accountAgeHours: number;
  /** Other accounts seen on this device. */
  sharedDeviceAccounts: number;
}

export type InvoiceDecision = 'auto_approve' | 'review' | 'flag' | 'reject';

export interface InvoiceRiskResult extends RiskAssessment {
  decision: InvoiceDecision;
  rejectReason: RiskCode | null;
}

const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.max(Math.abs(a), Math.abs(b)));

/**
 * Explainable invoice risk. Each signal adds a fixed weight and a stable code that the review
 * console shows in plain language. Only invoices with a valid ZATCA signature from a key the dealer
 * is known to use, at low risk, are approved without a person looking at them — and only when the
 * photo independently confirms what the signature does not cover: the total and the issue date
 * (QR tags 3–5 are plain text a client can rewrite).
 */
export function assessInvoice(input: InvoiceRiskInput, eco: Economics): InvoiceRiskResult {
  const reasons: RiskReason[] = [];
  const add = (code: RiskCode, weight: number, detail?: RiskReason['detail']) => reasons.push({ code, weight, detail });
  const { qr, extraction } = input;

  if (!qr.payloadPresent) add('qr_missing', 25);
  else if (!qr.decoded) add('qr_unreadable', 20);
  else if (qr.phase === 1) add('qr_phase1', 10);

  if (qr.signature === 'invalid') add('signature_invalid', 45);
  if (qr.signature === 'valid' && qr.keyKnown === false) add('dealer_key_unknown', 25);

  if (qr.decoded) {
    if (!input.dealer.found) add('dealer_not_partner', 30);
    else if (!input.dealer.active) add('dealer_inactive', 30);
    // A dealer whose till signs its invoices does not print unsigned ones: a Phase 1 copy of a
    // signed receipt is how a duplicate would slip past the hash-based fingerprint.
    if (qr.phase === 1 && input.dealer.hasKeys) add('phase1_from_signing_dealer', 35);
  }

  if (extraction) {
    if (!extraction.isTaxInvoice) add('not_tax_invoice', 50);
    if (extraction.editingSuspected) add('editing_suspected', 40);
    if (qr.total !== null && extraction.total !== null && relDiff(qr.total, extraction.total) > 0.02)
      add('ai_total_mismatch', 35, { qr: qr.total, photo: extraction.total });
    if (qr.vatNumber && extraction.sellerVat && extraction.sellerVat !== qr.vatNumber) add('ai_vat_mismatch', 30);
    if (input.qrIssuedAt && input.aiIssuedAt && Math.abs(input.qrIssuedAt.getTime() - input.aiIssuedAt.getTime()) > 36 * 3_600_000)
      add('ai_date_mismatch', 30, { qr: input.qrIssuedAt.toISOString().slice(0, 10), photo: input.aiIssuedAt.toISOString().slice(0, 10) });
  } else {
    add('ai_unavailable', input.aiConfigured ? 10 : 5);
  }
  if (!input.issuedAt) add('issue_date_unknown', 10);

  if (input.declaredAmount !== null && input.total !== null && relDiff(input.declaredAmount, input.total) > 0.05)
    add('declared_mismatch', 15, { declared: input.declaredAmount, detected: input.total });

  if (input.issuedAt) {
    const ageDays = (input.now.getTime() - input.issuedAt.getTime()) / 86_400_000;
    if (ageDays > eco.invoiceMaxAgeDays) add('invoice_too_old', 0, { days: Math.floor(ageDays) });
    else if (ageDays < -1) add('invoice_future', 40);
  }

  if (input.total === null || input.total <= 0) add('amount_unknown', 0);
  else {
    if (input.total > eco.invoiceMaxAmountSar) add('amount_over_cap', 25, { total: input.total });
    else if (input.dealerP95 && input.total > input.dealerP95 * 2) add('amount_atypical', 15, { total: input.total, p95: input.dealerP95 });
  }

  if (input.invoicesToday >= eco.dailyInvoiceCap) add('velocity', 20, { today: input.invoicesToday });
  if (input.accountAgeHours < 24) add('new_account', 10);
  if (input.sharedDeviceAccounts > 0) add('shared_device', 30, { accounts: input.sharedDeviceAccounts });

  const score = totalRisk(reasons);
  const has = (code: RiskCode) => reasons.some((r) => r.code === code);
  const rejectReason = (['invoice_too_old', 'amount_unknown'] as const).find(has) ?? null;
  // The independent witness: the photo shows the same total (and, when both are known, the same day).
  const photoConfirms = !!extraction && extraction.total !== null && qr.total !== null && !has('ai_total_mismatch') && !has('ai_date_mismatch') && !has('editing_suspected');
  let decision: InvoiceDecision;
  if (rejectReason) decision = 'reject';
  else if (score >= eco.flagMinRisk) decision = 'flag';
  else if (
    score <= eco.autoApproveMaxRisk &&
    qr.signature === 'valid' &&
    qr.keyKnown === true &&
    input.dealer.found &&
    input.dealer.active &&
    photoConfirms &&
    !!input.issuedAt &&
    input.invoicesToday < eco.dailyInvoiceCap
  )
    decision = 'auto_approve';
  else decision = 'review';
  return { score, reasons, decision, rejectReason };
}
