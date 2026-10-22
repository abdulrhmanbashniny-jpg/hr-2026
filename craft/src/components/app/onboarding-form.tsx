'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, CircleAlert, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MembershipCard } from '@/components/card/membership-card';
import { Button } from '@/components/ui/button';
import { confetti } from '@/components/ui/confetti';
import { Checkbox, Field, Input, Select } from '@/components/ui/field';
import { api, ApiClientError, deviceHint } from '@/lib/api-client';
import type { Catalogue } from '@/lib/catalogue';
import { parseReferralCode } from '@/lib/codes/damm';
import { cn } from '@/lib/cn';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';

export function OnboardingForm({ catalogue, initialRef }: { catalogue: Pick<Catalogue, 'cities' | 'regions' | 'trades'>; initialRef: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [name, setName] = useState('');
  const [cityId, setCityId] = useState('');
  const [trades, setTrades] = useState<string[]>([]);
  const [years, setYears] = useState('5');
  const [ref, setRef] = useState(initialRef);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState<{ referralCode: string } | null>(null);

  const refCheck = ref.trim() ? parseReferralCode(ref) : null;
  const refQuery = useQuery({
    queryKey: ['ref', refCheck?.ok ? refCheck.code : null],
    queryFn: () => api<{ referrer: { displayName: string; city: { nameAr: string; nameEn: string } } }>('/referrals/validate', { body: { code: refCheck!.ok ? refCheck!.code : '' } }),
    enabled: !!refCheck?.ok,
    retry: false,
  });

  const byRegion = useMemo(() => {
    const groups = catalogue.regions.map((r) => ({ region: r, cities: catalogue.cities.filter((c) => c.regionCode === r.code) })).filter((g) => g.cities.length);
    return groups.sort((a, b) => b.cities.length - a.cities.length);
  }, [catalogue]);

  const submit = useMutation({
    mutationFn: () =>
      api<{ referralCode: string }>('/onboarding', {
        body: { displayName: name, cityId, trades, yearsExperience: Number(years) || 0, referralCode: refCheck?.ok ? refCheck.code : null, consent: true, fp: deviceHint() },
      }),
    onSuccess: (r) => {
      setDone(r);
      confetti();
      setTimeout(() => {
        router.replace('/app');
        router.refresh();
      }, 2600);
    },
  });

  const refError = refCheck && !refCheck.ok ? t.errors.invalid_code : refQuery.error instanceof ApiClientError ? refQuery.error.message : null;
  const valid = name.trim().length >= 2 && cityId && consent && !refError && !(refCheck?.ok && !refQuery.data);
  const city = catalogue.cities.find((c) => c.id === cityId);

  if (done)
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <MembershipCard flippable={false} data={{ name, code: done.referralCode, tier: 'C', city: city ? (locale === 'ar' ? city.nameAr : city.nameEn) : '', memberSince: new Date().toISOString() }} />
        <div>
          <h2 className="text-2xl font-bold">{t.onboarding.doneTitle}</h2>
          <p className="mt-2 text-muted">{f(t.onboarding.doneBody, { code: done.referralCode })}</p>
        </div>
      </div>
    );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) submit.mutate();
      }}
    >
      <Field label={t.onboarding.name} htmlFor="name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.onboarding.namePlaceholder} maxLength={60} autoFocus required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field label={t.onboarding.city} htmlFor="city">
          <Select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)} required>
            <option value="">{t.onboarding.cityPlaceholder}</option>
            {byRegion.map((g) => (
              <optgroup key={g.region.code} label={locale === 'ar' ? g.region.nameAr : g.region.nameEn}>
                {g.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === 'ar' ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label={t.onboarding.years} htmlFor="years">
          <Input id="years" inputMode="numeric" className="num" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </Field>
      </div>
      <Field label={t.onboarding.trades}>
        <div className="flex flex-wrap gap-2">
          {catalogue.trades.map((tr) => {
            const on = trades.includes(tr.id);
            return (
              <button
                key={tr.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTrades((xs) => (on ? xs.filter((x) => x !== tr.id) : [...xs, tr.id].slice(0, 8)))}
                className={cn('press rounded-xl border px-3 py-2 text-sm transition', on ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line bg-surface-container-lowest text-ink-2 hover:border-line-strong')}
              >
                {locale === 'ar' ? tr.nameAr : tr.nameEn}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label={`${t.onboarding.referral} (${t.common.optional})`} hint={t.onboarding.referralHint} htmlFor="ref">
        <div className="relative">
          <Input id="ref" inputMode="numeric" className="num tracking-[0.2em]" value={ref} onChange={(e) => setRef(e.target.value.slice(0, 10))} aria-invalid={!!refError} />
          <span className="absolute inset-y-0 end-3 grid place-items-center">
            {refQuery.isFetching ? <LoaderCircle className="size-4 animate-spin text-muted" /> : refQuery.data ? <BadgeCheck className="size-5 text-success" /> : refError ? <CircleAlert className="size-5 text-danger" /> : null}
          </span>
        </div>
        {refError ? (
          <p className="text-[13px] text-danger">{refError}</p>
        ) : refQuery.data ? (
          <p className="text-[13px] text-success">{f(t.onboarding.referralValid, { name: refQuery.data.referrer.displayName, city: locale === 'ar' ? refQuery.data.referrer.city.nameAr : refQuery.data.referrer.city.nameEn })}</p>
        ) : null}
      </Field>
      <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t.onboarding.consent} />
      {submit.error && <p className="text-sm text-danger">{submit.error instanceof ApiClientError ? submit.error.message : t.errors.generic}</p>}
      <Button type="submit" variant="accent" size="lg" className="w-full" loading={submit.isPending} disabled={!valid}>
        {t.onboarding.submit}
      </Button>
    </form>
  );
}
