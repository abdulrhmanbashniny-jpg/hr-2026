import { normalizeArabic } from '@/lib/imports/normalize';
import type { TenantSettings } from '@/lib/settings';

export type OpCardReason = 'manual_required' | 'manual_exempt' | 'registration_type' | 'light_vehicle' | 'not_commercial';

export interface VehicleLike {
  registrationType: string | null;
  model: string | null;
  bodyType: string | null;
  operatingCardRequirement: 'auto' | 'required' | 'exempt';
}

const includesAny = (haystack: string, needles: string[]) => needles.some((n) => n && haystack.includes(normalizeArabic(n)));

/**
 * Only medium and heavy transport vehicles registered as private or public transport need an
 * operating card from the Transport General Authority. Light vehicles (pickups, sedans…) under those
 * registrations are exempt unless the company marks them as required.
 */
export function operatingCardRequirement(v: VehicleLike, settings: TenantSettings): { required: boolean; reason: OpCardReason } {
  if (v.operatingCardRequirement === 'required') return { required: true, reason: 'manual_required' };
  if (v.operatingCardRequirement === 'exempt') return { required: false, reason: 'manual_exempt' };
  const reg = normalizeArabic(v.registrationType ?? '');
  if (!reg || !includesAny(reg, settings.operatingCardRegistrationTypes)) return { required: false, reason: 'not_commercial' };
  const shape = normalizeArabic(`${v.model ?? ''} ${v.bodyType ?? ''}`);
  if (includesAny(shape, settings.lightVehicleKeywords)) return { required: false, reason: 'light_vehicle' };
  return { required: true, reason: 'registration_type' };
}

/** Occupations regulated by the Transport General Authority (need a driver card). */
export function isRegulatedDriverOccupation(occupation: string | null | undefined, settings: TenantSettings): boolean {
  if (!occupation) return false;
  const occ = normalizeArabic(occupation);
  if (includesAny(occ, settings.excludedDriverOccupations)) return false;
  return includesAny(occ, settings.heavyDriverOccupations);
}

export function isActiveCardStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  const s = normalizeArabic(status);
  return s.includes('نشط') || s.includes('ساري') || s.includes('active') || s.includes('valid');
}

export function isInsuranceValid(status: string | null | undefined): boolean | null {
  if (!status) return null;
  const s = normalizeArabic(status);
  if (s.includes('غير ساري') || s.includes('منتهي') || s.includes('لا يوجد')) return false;
  return s.includes('ساري') || s.includes('valid');
}

export function isRestricted(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = normalizeArabic(status);
  return s.includes('متحفظ') && !s.includes('غير');
}

export function sameOccupation(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true;
  return normalizeArabic(a) === normalizeArabic(b);
}
