import { redirect } from 'next/navigation';
import { currentUserHome } from '@/app/actions/auth';
import { RegisterForm } from '@/components/auth/forms';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.auth.registerTitle };
}

export default async function RegisterPage(props: PageProps<'/register'>) {
  const home = await currentUserHome();
  if (home) redirect(home);
  const { t } = await getI18n();
  const { promo } = await props.searchParams;
  return (
    <div className="ui-card" style={{ maxWidth: 620, marginInline: 'auto', width: '100%' }}>
      <h1 className="text-xl font-bold">{t.auth.registerTitle}</h1>
      <p className="mb-5 text-sm text-muted">{t.auth.registerSubtitle}</p>
      <RegisterForm promo={typeof promo === 'string' ? promo : undefined} />
    </div>
  );
}
