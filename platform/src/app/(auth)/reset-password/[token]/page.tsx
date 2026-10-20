import { ResetForm } from '@/components/auth/forms';
import { getI18n } from '@/lib/i18n';

export default async function ResetPage(props: PageProps<'/reset-password/[token]'>) {
  const { t } = await getI18n();
  const { token } = await props.params;
  return (
    <div className="ui-card">
      <h1 className="mb-5 text-xl font-bold">{t.auth.resetTitle}</h1>
      <ResetForm token={token} />
    </div>
  );
}
