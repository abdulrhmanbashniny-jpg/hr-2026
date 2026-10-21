import { parseReferralCode } from '@/lib/codes/damm';
import { ApiError } from '@/lib/http';

/** Route param → code; the check digit is verified before any database work. */
export function codeFromParam(raw: string): string {
  const parsed = parseReferralCode(decodeURIComponent(raw));
  if (!parsed.ok) throw new ApiError('invalid_code', 400, { reason: parsed.reason });
  return parsed.code;
}

export const LEAD_SOURCES = ['qr', 'nfc', 'search', 'link', 'wallet', 'direct'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export function leadSource(v: string | null | undefined): LeadSource {
  return (LEAD_SOURCES as readonly string[]).includes(v ?? '') ? (v as LeadSource) : 'direct';
}
