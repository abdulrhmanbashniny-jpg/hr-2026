import { describe, expect, it } from 'vitest';
import { assessInvoice, type InvoiceRiskInput } from '@/lib/fraud/invoice-risk';
import { assessReferral, phoneDistance } from '@/lib/fraud/referral-risk';
import { DEFAULT_ECONOMICS as eco } from '@/lib/settings/economics';

const now = new Date('2026-10-21T10:00:00Z');
const clean: InvoiceRiskInput = {
  now,
  qr: { payloadPresent: true, decoded: true, phase: 2, signature: 'valid', keyKnown: true, vatNumber: '310122393500003', total: 1150 },
  dealer: { found: true, active: true },
  extraction: null,
  aiConfigured: false,
  declaredAmount: 1150,
  issuedAt: new Date('2026-10-20T10:00:00Z'),
  total: 1150,
  dealerP95: 3000,
  invoicesToday: 0,
  accountAgeHours: 500,
  sharedDeviceAccounts: 0,
};

describe('invoice risk', () => {
  it('auto-approves a signed invoice from a known dealer key', () => {
    expect(assessInvoice(clean, eco)).toMatchObject({ score: 0, decision: 'auto_approve', rejectReason: null });
  });

  it('sends an unknown signing key to review, never auto-approves', () => {
    const r = assessInvoice({ ...clean, qr: { ...clean.qr, keyKnown: false } }, eco);
    expect(r.decision).toBe('review');
    expect(r.reasons.map((x) => x.code)).toContain('dealer_key_unknown');
  });

  it('reviews invoices without a QR code even at low risk', () => {
    const r = assessInvoice({ ...clean, qr: { payloadPresent: false, decoded: false, phase: null, signature: 'absent', keyKnown: null, vatNumber: null, total: null } }, eco);
    expect(r.decision).toBe('review');
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['qr_missing', 'ai_unavailable']));
  });

  it('flags a forged signature with an edited photo', () => {
    const r = assessInvoice(
      {
        ...clean,
        qr: { ...clean.qr, signature: 'invalid', keyKnown: null },
        extraction: { isTaxInvoice: true, sellerName: null, sellerVat: '310122393500003', invoiceNumber: null, issuedAt: null, total: 115, vat: 15, currency: 'SAR', paintLineItems: 1, editingSuspected: true, notes: null, model: 'test' },
      },
      eco,
    );
    expect(r.decision).toBe('flag');
    expect(r.score).toBe(100);
  });

  it('rejects invoices past the age limit and those without any amount', () => {
    expect(assessInvoice({ ...clean, issuedAt: new Date('2026-08-01T00:00:00Z') }, eco)).toMatchObject({ decision: 'reject', rejectReason: 'invoice_too_old' });
    expect(assessInvoice({ ...clean, total: null }, eco)).toMatchObject({ decision: 'reject', rejectReason: 'amount_unknown' });
  });

  it('adds velocity, new-account and shared-device signals', () => {
    const r = assessInvoice({ ...clean, invoicesToday: 5, accountAgeHours: 2, sharedDeviceAccounts: 2 }, eco);
    expect(r.score).toBe(60);
    expect(r.decision).toBe('flag');
  });

  it('notices a declared amount far from the detected one and atypical totals', () => {
    const r = assessInvoice({ ...clean, declaredAmount: 2000, total: 7000, qr: { ...clean.qr, total: 7000 } }, eco);
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['declared_mismatch', 'amount_atypical']));
  });
});

describe('referral risk', () => {
  const base = { sameDeviceAsReferrer: false, sameNetworkRecent: false, referrerReferralsLast24h: 0, refereePhone: '+966551234567', referrerPhone: '+966561112222', sharedDeviceAccounts: 0 };

  it('passes an ordinary referral', () => {
    expect(assessReferral(base)).toMatchObject({ score: 0, hold: false });
  });

  it('holds a referral from the same device', () => {
    expect(assessReferral({ ...base, sameDeviceAsReferrer: true }).hold).toBe(true);
  });

  it('holds bursts of consecutive SIMs on one network', () => {
    const r = assessReferral({ ...base, sameNetworkRecent: true, referrerReferralsLast24h: 6, referrerPhone: '+966551234570' });
    expect(r.score).toBe(70);
    expect(r.hold).toBe(true);
  });

  it('measures phone distance on the subscriber number', () => {
    expect(phoneDistance('+966551234567', '+966551234570')).toBe(3);
  });
});
