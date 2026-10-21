import { MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { MembershipCard } from '@/components/card/membership-card';
import { Avatar } from '@/components/ui/avatar';
import { getSession } from '@/lib/auth/session';
import { parseReferralCode } from '@/lib/codes/damm';
import { getPublicProfile } from '@/lib/craftsmen/public';
import { f, getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.onboarding.title };
}

/** Landing page of a referral link: shows who invited you; the proxy keeps the code in a cookie for onboarding. */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { t, locale } = await getI18n();
  const ref = parseReferralCode((await searchParams).ref ?? '');
  const referrer = ref.ok ? await getPublicProfile(ref.code) : null;
  const s = await getSession();
  if (s) redirect(s.craftsman ? '/app' : '/app/onboarding');
  return (
    <AuthShell
      aside={
        <div className="w-full max-w-md -rotate-3">
          <MembershipCard flippable={false} data={{ name: locale === 'ar' ? 'بطاقتك المهنية' : 'Your professional card', code: '839210', tier: 'C', city: locale === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia', memberSince: new Date().toISOString() }} />
        </div>
      }
    >
      {referrer && (
        <div className="surface mb-8 flex items-center gap-3 p-3.5">
          <Avatar name={referrer.displayName} size={44} />
          <div className="min-w-0">
            <div className="font-semibold text-ink">{f(t.auth.referredBy, { name: referrer.displayName })}</div>
            <div className="flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3" />
              {locale === 'ar' ? referrer.city.nameAr : referrer.city.nameEn} · {t.tiers.short[referrer.tier]}
            </div>
          </div>
        </div>
      )}
      <h1 className="text-3xl font-bold">{t.onboarding.title}</h1>
      <p className="mt-2 mb-8 text-muted">{t.auth.subtitle}</p>
      <LoginForm next="/app/onboarding" />
    </AuthShell>
  );
}
