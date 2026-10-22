import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/brand/icons';
import { OnboardingForm } from '@/components/app/onboarding-form';
import { LanguageSwitch } from '@/components/public/language-switch';
import { requirePortalPage } from '@/lib/auth/guards';
import { isStaff } from '@/lib/auth/roles';
import { catalogue } from '@/lib/catalogue';
import { getI18n } from '@/lib/i18n';

export default async function OnboardingPage() {
  const s = await requirePortalPage('/app/onboarding');
  if (s.craftsman) redirect('/app');
  if (isStaff(s.user.role)) redirect('/admin');
  const { t } = await getI18n();
  const { cities, regions, trades } = await catalogue();
  const ref = (await cookies()).get('hirfa_ref')?.value ?? '';
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-14">
      <div className="mb-8 flex items-center justify-between">
        <Logo name={t.meta.product} tagline={t.meta.tagline} />
        <LanguageSwitch />
      </div>
      <div className="rounded-2xl border border-line bg-surface-container-lowest p-6 shadow-xl sm:p-8">
        <h1 className="text-headline-lg-mobile text-primary sm:text-headline-lg">{t.onboarding.title}</h1>
        <p className="mt-2 mb-8 text-body-md text-on-surface-variant">{t.onboarding.subtitle}</p>
        <OnboardingForm catalogue={{ cities, regions, trades }} initialRef={/^\d{6,7}$/.test(ref) ? ref : ''} />
      </div>
    </div>
  );
}
