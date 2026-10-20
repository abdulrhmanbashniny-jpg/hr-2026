import { ForgotForm } from '@/components/auth/forms';
import { getI18n } from '@/lib/i18n';

export default async function ForgotPage() {
  const { t } = await getI18n();
  return (
    <div className="ui-card">
      <h1 className="text-2xl font-bold">{t.auth.forgotTitle}</h1>
      <p className="mb-5 text-sm text-muted">{t.auth.forgotSubtitle}</p>
      <ForgotForm />
    </div>
  );
}
