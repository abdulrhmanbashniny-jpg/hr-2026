import { EconomicsForm } from '@/components/admin/economics-form';
import { requireStaffPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';
import { getEconomics } from '@/lib/settings/store';

export default async function SettingsPage() {
  await requireStaffPage('settings:manage');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.settings.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.settings.subtitle}</p>
      </div>
      <EconomicsForm value={await getEconomics()} />
    </div>
  );
}
