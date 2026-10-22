export type RiskCode =
  | 'qr_missing'
  | 'qr_unreadable'
  | 'qr_phase1'
  | 'signature_invalid'
  | 'dealer_key_unknown'
  | 'dealer_not_partner'
  | 'dealer_inactive'
  | 'ai_total_mismatch'
  | 'ai_vat_mismatch'
  | 'ai_unavailable'
  | 'ai_date_mismatch'
  | 'issue_date_unknown'
  | 'phase1_from_signing_dealer'
  | 'declared_mismatch'
  | 'invoice_too_old'
  | 'invoice_future'
  | 'amount_unknown'
  | 'duplicate_invoice'
  | 'amount_over_cap'
  | 'amount_atypical'
  | 'velocity'
  | 'new_account'
  | 'shared_device'
  | 'editing_suspected'
  | 'not_tax_invoice'
  | 'same_device_as_referrer'
  | 'same_network_recent'
  | 'referral_burst'
  | 'adjacent_phone';

export interface RiskReason {
  code: RiskCode;
  weight: number;
  detail?: Record<string, string | number>;
}

export interface RiskAssessment {
  score: number;
  reasons: RiskReason[];
}

export function totalRisk(reasons: RiskReason[]): number {
  return Math.min(100, reasons.reduce((s, r) => s + r.weight, 0));
}
