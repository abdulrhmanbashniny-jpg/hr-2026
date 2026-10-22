'use client';

import { ArrowRight, BadgeCheck, CircleCheck, Lock, MapPin, ShieldCheck, Smartphone, UserRound, UserRoundPlus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { saveSignupDraft, loadSignupDraft } from '@/components/auth/signup-draft';
import { Dialog } from '@/components/ui/dialog';
import { api, ApiClientError } from '@/lib/api-client';
import { parseReferralCode } from '@/lib/codes/damm';
import { digitsOnly } from '@/lib/digits';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { landingStrings } from '@/lib/i18n/pages/landing';
import type { Tier } from '@/lib/incentives/engine';
import { normalizeSaudiMobile } from '@/lib/phone';

export interface CityOption {
  id: string;
  name: string;
}

type Referrer = { code: string; displayName: string } | null;

const label = 'mb-1.5 block text-label-md font-semibold text-primary-container';
const control =
  'h-12 w-full rounded-xl border border-line bg-surface-container-lowest px-space-md text-body-md text-[#0F172A] outline-none transition placeholder:text-muted focus:border-accent-2 focus:ring-[3px] focus:ring-[var(--ring)] aria-[invalid=true]:border-[#EF4444]';

/**
 * "إنشاء عضوية جديدة": the sign-up card from the design. The details are kept in this tab while the
 * visitor confirms their mobile with a one-time code, then the onboarding step picks them up.
 */
export function SignupCard({ cities, welcomeBonus, initialRef }: { cities: CityOption[]; welcomeBonus: number; initialRef?: string | null }) {
  const { t, locale } = useI18n();
  const s = landingStrings(locale);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState<Tier | ''>('');
  const [cityId, setCityId] = useState('');
  const [district, setDistrict] = useState('');
  const [ref, setRef] = useState(initialRef ?? '');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [referrer, setReferrer] = useState<Referrer>(null);
  const [checking, setChecking] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [showTerms, setShowTerms] = useState(false);
  const lastChecked = useRef('');

  useEffect(() => {
    const d = loadSignupDraft();
    if (!d) return;
    setName(d.name);
    setPhone(d.phone);
    setTier(d.classification);
    setCityId(d.cityId);
    setDistrict(d.district);
    if (!initialRef) setRef(d.referralCode);
  }, [initialRef]);

  // Check the colleague's code as soon as it is complete: the Damm digit catches typos offline first.
  useEffect(() => {
    const digits = digitsOnly(ref);
    const parsed = parseReferralCode(digits);
    if (!digits) {
      setReferrer(null);
      setErrors((e) => ({ ...e, ref: '' }));
      return;
    }
    if (!parsed.ok) {
      setReferrer(null);
      if (digits.length >= 6) setErrors((e) => ({ ...e, ref: parsed.reason === 'checksum' ? t.search.invalidChecksum : t.search.invalidLength }));
      return;
    }
    if (lastChecked.current === parsed.code) return;
    lastChecked.current = parsed.code;
    setChecking(true);
    api<{ referrer: { code: string; displayName: string } }>('/referrals/validate', { body: { code: parsed.code } })
      .then((r) => {
        setReferrer(r.referrer);
        setErrors((e) => ({ ...e, ref: '' }));
      })
      .catch((err) => {
        setReferrer(null);
        setErrors((e) => ({ ...e, ref: err instanceof ApiClientError ? err.message : t.errors.generic }));
      })
      .finally(() => setChecking(false));
  }, [ref, t]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = s.signup.errName;
    if (!normalizeSaudiMobile(phone)) next.phone = t.errors.invalid_phone;
    if (!tier) next.tier = s.signup.errClassification;
    if (!cityId) next.city = s.signup.errCity;
    if (ref && !referrer) next.ref = errors.ref || t.search.invalidLength;
    if (!terms) next.terms = s.signup.errTerms;
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    saveSignupDraft({ name: name.trim(), phone, classification: tier, cityId, district: district.trim(), referralCode: referrer ? referrer.code : '', terms });
    // Carry the referral the same way the /join link does, so onboarding credits the colleague.
    if (referrer) document.cookie = `hirfa_ref=${referrer.code}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    if (navigator.vibrate) navigator.vibrate(10);
    setStep('otp');
  }

  return (
    <div id="join" className="scroll-mt-28 rounded-2xl border border-line bg-surface-container-lowest p-space-md shadow-xl sm:p-space-lg">
      <div className="mb-space-lg flex items-start justify-between gap-space-md">
        <div>
          <h2 className="text-headline-md text-primary">{step === 'form' ? s.signup.title : s.signup.otpTitle}</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">{step === 'form' ? s.signup.subtitle : s.signup.otpSubtitle}</p>
        </div>
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary-fixed/50 text-secondary">
          <UserRoundPlus className="size-6" />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'form' ? (
          <motion.form key="form" onSubmit={submit} noValidate initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="space-y-space-md">
            <div>
              <label htmlFor="su-name" className={label}>
                {s.signup.name}
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-outline" />
                <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={s.signup.namePlaceholder} aria-invalid={!!errors.name} className={`${control} ps-11`} />
              </div>
              {errors.name && <p className="mt-1 text-body-sm text-[#B91C1C]">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="su-phone" className={label}>
                {s.signup.phone}
              </label>
              <div className="flex h-12 items-center overflow-hidden rounded-xl border border-line bg-surface-container-lowest transition focus-within:border-accent-2 focus-within:ring-[3px] focus-within:ring-[var(--ring)]" dir="ltr">
                <span className="num flex h-full items-center border-e border-line bg-surface-container-low px-3 text-body-sm text-on-surface-variant">+966</span>
                <input id="su-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="05X XXX XXXX" aria-invalid={!!errors.phone} className="num h-full min-w-0 flex-1 bg-transparent px-3 text-body-lg tracking-wider text-[#0F172A] outline-none placeholder:text-muted" />
                <Smartphone className="me-3 size-5 text-outline" />
              </div>
              {errors.phone && <p className="mt-1 text-body-sm text-[#B91C1C]">{errors.phone}</p>}
            </div>

            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
              <div>
                <label htmlFor="su-tier" className={label}>
                  {s.signup.classification}
                </label>
                <select id="su-tier" value={tier} onChange={(e) => setTier(e.target.value as Tier | '')} aria-invalid={!!errors.tier} className={control}>
                  <option value="">{s.signup.classificationPlaceholder}</option>
                  {(['A', 'B', 'C'] as const).map((k) => (
                    <option key={k} value={k}>
                      {t.tiers.role[k]}
                    </option>
                  ))}
                </select>
                {errors.tier ? <p className="mt-1 text-body-sm text-[#B91C1C]">{errors.tier}</p> : <p className="mt-1 text-body-sm text-muted">{s.signup.classificationHint}</p>}
              </div>
              <div>
                <label htmlFor="su-city" className={label}>
                  {s.signup.city}
                </label>
                <select id="su-city" value={cityId} onChange={(e) => setCityId(e.target.value)} aria-invalid={!!errors.city} className={control}>
                  <option value="">{s.signup.cityPlaceholder}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.city && <p className="mt-1 text-body-sm text-[#B91C1C]">{errors.city}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="su-district" className={label}>
                {s.signup.district}
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-outline" />
                <input id="su-district" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={s.signup.districtPlaceholder} className={`${control} ps-11`} />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="su-ref" className="text-label-md font-semibold text-primary-container">
                  {s.signup.referral} <span className="font-normal text-muted">({t.common.optional})</span>
                </label>
                {welcomeBonus > 0 && <span className="text-label-sm text-secondary">{f(s.signup.referralBonus, { points: welcomeBonus })}</span>}
              </div>
              <input id="su-ref" value={ref} onChange={(e) => setRef(e.target.value)} inputMode="numeric" placeholder={s.signup.referralPlaceholder} aria-invalid={!!errors.ref} className={`${control} code-id text-center text-headline-sm tracking-[0.25em]`} dir="ltr" />
              {checking && <p className="mt-1 text-body-sm text-muted">{s.signup.referralChecking}</p>}
              {referrer && !checking && (
                <p className="mt-1 flex items-center gap-1.5 text-body-sm text-[#047857]">
                  <BadgeCheck className="size-4" />
                  {f(s.auth.invited, { name: referrer.displayName })}
                </p>
              )}
              {errors.ref && !checking && <p className="mt-1 text-body-sm text-[#B91C1C]">{errors.ref}</p>}
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-space-sm text-body-sm text-on-surface-variant">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md accent-[#102a43]" />
                <span>
                  {s.signup.termsBefore}{' '}
                  <button type="button" onClick={() => setShowTerms(true)} className="font-semibold text-secondary underline underline-offset-2">
                    {s.signup.termsLink}
                  </button>{' '}
                  {s.signup.termsAfter}
                </span>
              </label>
              {errors.terms && <p className="mt-1 text-body-sm text-[#B91C1C]">{errors.terms}</p>}
            </div>

            <button type="submit" className="press amber-gradient flex h-13 w-full items-center justify-center gap-2 rounded-xl text-label-lg text-primary-container shadow-md hover:brightness-105 active:scale-[0.98]">
              <CircleCheck className="size-5" />
              {s.signup.submit}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-center text-body-sm text-muted">
              <Lock className="size-4" />
              {s.signup.secure}
            </p>
            <p className="text-center text-body-sm text-on-surface-variant">
              {s.signup.haveAccount}{' '}
              <Link href="/login" className="font-semibold text-primary-container underline underline-offset-2">
                {s.signup.signIn}
              </Link>
            </p>
          </motion.form>
        ) : (
          <motion.div key="otp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="space-y-space-md">
            <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
              <ShieldCheck className="size-5 shrink-0 text-secondary" />
              <span className="min-w-0 flex-1 truncate">
                {name} · {cities.find((c) => c.id === cityId)?.name} · {tier ? t.tiers.role[tier] : ''}
              </span>
              <button type="button" onClick={() => setStep('form')} className="inline-flex shrink-0 items-center gap-1 text-label-md text-primary-container hover:underline">
                <ArrowRight className="size-4 ltr:rotate-180" />
                {s.signup.editDetails}
              </button>
            </div>
            <LoginForm next="/app/onboarding" initialPhone={phone} autoSend />
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showTerms} onClose={() => setShowTerms(false)} title={s.terms.title}>
        <p className="mb-space-sm text-body-md text-on-surface-variant">{s.terms.intro}</p>
        <ul className="space-y-2">
          {s.terms.items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-body-md text-on-surface">
              <CircleCheck className="mt-1 size-4 shrink-0 text-[#047857]" />
              {item}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            setTerms(true);
            setShowTerms(false);
          }}
          className="press mt-space-lg h-11 w-full rounded-xl bg-primary-container text-label-lg text-white"
        >
          {s.terms.agree}
        </button>
      </Dialog>
    </div>
  );
}
