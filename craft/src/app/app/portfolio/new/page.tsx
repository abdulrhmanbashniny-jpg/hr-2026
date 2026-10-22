import { redirect } from 'next/navigation';
import { ProjectEditor } from '@/components/app/project-editor';
import { PageHeader } from '@/components/ui/card';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { catalogue } from '@/lib/catalogue';
import { getI18n } from '@/lib/i18n';
import { listProjects, MAX_WORKS } from '@/lib/portfolio/service';

export default async function NewProjectPage() {
  const s = await requireCraftsmanPage('/app/portfolio/new');
  const { t } = await getI18n();
  // Three works is the limit: the list page explains it.
  if ((await listProjects(s.craftsman.id)).length >= MAX_WORKS) redirect('/app/portfolio');
  const { cities, brands } = await catalogue();
  return (
    <div>
      <PageHeader title={t.portfolio.newTitle} subtitle={t.portfolio.media.saveFirst} />
      <ProjectEditor catalogue={{ cities, brands }} defaultCityId={s.craftsman.cityId} />
    </div>
  );
}
