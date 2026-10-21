import { BadgeCheck, EyeOff, ImagePlus, Images, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { catalogue } from '@/lib/catalogue';
import { getI18n } from '@/lib/i18n';
import { listProjects } from '@/lib/portfolio/service';

export default async function PortfolioPage() {
  const s = await requireCraftsmanPage('/app/portfolio');
  const { t, locale } = await getI18n();
  const [projects, cat] = await Promise.all([listProjects(s.craftsman.id), catalogue()]);
  const cityName = (id: string | null) => {
    const c = cat.cities.find((x) => x.id === id);
    return c ? (locale === 'ar' ? c.nameAr : c.nameEn) : null;
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.portfolio.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.portfolio.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/c/${s.craftsman.referralCode}`} variant="secondary">
            {t.profile.verifiedBy}
          </ButtonLink>
          <ButtonLink href="/app/portfolio/new" variant="accent" icon={<ImagePlus className="size-5" />}>
            {t.portfolio.add}
          </ButtonLink>
        </div>
      </div>
      {projects.length === 0 ? (
        <EmptyState icon={<Images className="size-6" />} title={t.portfolio.empty} action={<ButtonLink href="/app/portfolio/new">{t.portfolio.add}</ButtonLink>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const cover = p.media.find((m) => m.role === 'after') ?? p.media[0];
            return (
              <Link key={p.id} href={`/app/portfolio/${p.id}`} className="surface lift group overflow-hidden">
                <div className="relative aspect-[4/3] bg-surface-2">
                  {cover && (
                    <img
                      src={(cover.kind === 'video' ? cover.posterUrl : (cover.thumbUrl ?? cover.url)) ?? undefined}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      style={cover.lqip ? { backgroundImage: `url(${cover.lqip})`, backgroundSize: 'cover' } : undefined}
                    />
                  )}
                  <div className="absolute top-3 start-3 flex gap-1.5">
                    {p.verification === 'field_verified' && (
                      <Badge tone="success" icon={<BadgeCheck className="size-3.5" />} className="shadow-sm">
                        {t.portfolio.verifiedBadge}
                      </Badge>
                    )}
                    {!p.isPublished && (
                      <Badge icon={<EyeOff className="size-3.5" />} className="shadow-sm">
                        {t.portfolio.fields.published}
                      </Badge>
                    )}
                  </div>
                  <span className="num absolute end-3 bottom-3 rounded-full bg-navy-950/60 px-2 py-0.5 text-xs text-white backdrop-blur">{p.media.length}/5</span>
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-semibold">{p.title}</h3>
                  {cityName(p.cityId) && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                      <MapPin className="size-3.5" />
                      {cityName(p.cityId)}
                      {p.district ? ` · ${p.district}` : ''}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
