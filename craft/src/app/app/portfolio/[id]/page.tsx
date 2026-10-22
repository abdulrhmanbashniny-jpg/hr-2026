import { notFound } from 'next/navigation';
import { ProjectEditor } from '@/components/app/project-editor';
import { Badge } from '@/components/ui/badge';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { catalogue } from '@/lib/catalogue';
import { getI18n } from '@/lib/i18n';
import { getProject } from '@/lib/portfolio/service';

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireCraftsmanPage('/app/portfolio');
  const { t } = await getI18n();
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const project = await getProject(s.craftsman.id, id).catch(() => null);
  if (!project) notFound();
  const { cities, brands } = await catalogue();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-headline-lg-mobile text-primary sm:text-headline-lg">{t.portfolio.editTitle}</h1>
        {project.verification === 'field_verified' && <Badge tone="success">{t.portfolio.verifiedBadge}</Badge>}
      </div>
      <ProjectEditor
        catalogue={{ cities, brands }}
        defaultCityId={s.craftsman.cityId}
        project={{
          ...project,
          productIds: project.productIds,
          media: project.media.map((m) => ({ id: m.id, kind: m.kind, role: m.role, url: m.url, thumbUrl: m.thumbUrl, posterUrl: m.posterUrl, lqip: m.lqip })),
        }}
      />
    </div>
  );
}
