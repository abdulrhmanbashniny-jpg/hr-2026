'use client';

import type { Tier } from '@/lib/incentives/engine';

/**
 * What the visitor typed into the sign-up card before confirming their mobile. It lives in
 * sessionStorage (this tab only) and is read back by the onboarding form after the OTP step.
 */
export interface SignupDraft {
  name: string;
  phone: string;
  /** Self-declared role; staff assign the real tier. */
  classification: Tier | '';
  cityId: string;
  district: string;
  referralCode: string;
  terms: boolean;
  savedAt: number;
}

export const SIGNUP_DRAFT_KEY = 'signup-draft';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function saveSignupDraft(draft: Omit<SignupDraft, 'savedAt'>): void {
  try {
    sessionStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Private mode or storage disabled: onboarding simply starts empty.
  }
}

export function loadSignupDraft(): SignupDraft | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SignupDraft>;
    if (!d || typeof d !== 'object' || typeof d.savedAt !== 'number' || Date.now() - d.savedAt > MAX_AGE_MS) return null;
    const tier = d.classification === 'A' || d.classification === 'B' || d.classification === 'C' ? d.classification : '';
    return {
      name: typeof d.name === 'string' ? d.name.slice(0, 60) : '',
      phone: typeof d.phone === 'string' ? d.phone.slice(0, 20) : '',
      classification: tier,
      cityId: typeof d.cityId === 'string' ? d.cityId.slice(0, 40) : '',
      district: typeof d.district === 'string' ? d.district.slice(0, 60) : '',
      referralCode: typeof d.referralCode === 'string' ? d.referralCode.replace(/\D/g, '').slice(0, 7) : '',
      terms: d.terms === true,
      savedAt: d.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearSignupDraft(): void {
  try {
    sessionStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}
