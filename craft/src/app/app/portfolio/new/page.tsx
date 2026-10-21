import { ProjectEditor } from '@/components/app/project-editor';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { catalogue } from '@/lib/catalogue';
import { getI18n } from '@/lib/i18n';

export default async function NewProjectPage() {
  const s = await requireCraftsmanPage('/app/portfolio/new');
  const { t } = await getI18n();
  const { cities, brands } = await catalogue();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.portfolio.newTitle}</h1>
      <ProjectEditor catalogue={{ cities, brands }} defaultCityId={s.craftsman.cityId} />
    </div>
  );
}
