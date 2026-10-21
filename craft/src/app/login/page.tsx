import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { MembershipCard } from '@/components/card/membership-card';
import { getSession } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/roles';
import { getI18n } from '@/lib/i18n';
import { safeNext } from '@/lib/safe-next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.title, robots: { index: false } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { t, locale } = await getI18n();
  const s = await getSession();
  const next = (await searchParams).next;
  if (s) redirect(isStaff(s.user.role) ? safeNext(next, '/admin') : s.craftsman ? safeNext(next, '/app') : '/app/onboarding');
  return (
    <AuthShell
      aside={
        <div className="w-full max-w-md -rotate-3">
          <MembershipCard flippable={false} data={{ name: locale === 'ar' ? 'بطاقتك المهنية' : 'Your professional card', code: '839210', tier: 'A', city: locale === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia', memberSince: new Date().toISOString(), verified: true }} />
        </div>
      }
    >
      <h1 className="text-3xl font-bold">{t.auth.title}</h1>
      <p className="mt-2 mb-8 text-muted">{t.auth.subtitle}</p>
      <LoginForm next={next} />
    </AuthShell>
  );
}
