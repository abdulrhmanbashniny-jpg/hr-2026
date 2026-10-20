import { redirect } from 'next/navigation';
import { currentUserHome } from '@/app/actions/auth';
import { LoginForm } from '@/components/auth/forms';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.auth.loginTitle };
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const home = await currentUserHome();
  if (home) redirect(home);
  const { t } = await getI18n();
  const { next } = await props.searchParams;
  return (
    <div className="ui-card">
      <h1 className="text-2xl font-bold">{t.auth.loginTitle}</h1>
      <p className="mb-5 text-sm text-muted">{t.auth.loginSubtitle}</p>
      <LoginForm next={typeof next === 'string' ? next : undefined} />
    </div>
  );
}
