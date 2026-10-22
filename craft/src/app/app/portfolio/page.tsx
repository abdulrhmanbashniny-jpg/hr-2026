import { BadgeCheck, CloudUpload, Eye, EyeOff, Info, MapPin, Play, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/card';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { catalogue } from '@/lib/catalogue';
import { f, getI18n } from '@/lib/i18n';
import { listProjects, MAX_WORKS } from '@/lib/portfolio/service';

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const ext = (mime: string) => (mime.split('/')[1] ?? '').replace('quicktime', 'mov').replace('jpeg', 'jpg').toUpperCase();

export default async function PortfolioPage() {
  const s = await requireCraftsmanPage('/app/portfolio');
  const { t, locale } = await getI18n();
  const [projects, cat] = await Promise.all([listProjects(s.craftsman.id), catalogue()]);
  const cityName = (id: string | null) => {
    const c = cat.cities.find((x) => x.id === id);
    return c ? (locale === 'ar' ? c.nameAr : c.nameEn) : null;
  };
  const used = Math.min(projects.length, MAX_WORKS);
  const empty = Math.max(0, MAX_WORKS - projects.length);

  return (
    <div>
      <PageHeader
        title={t.portfolio.title}
        subtitle={t.portfolio.subtitle}
        actions={
          <>
            <Link href={`/c/${s.craftsman.referralCode}`} className="press inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-container-lowest px-space-md text-label-md text-primary-container shadow-xs hover:bg-canvas">
              <Eye className="size-4" />
              {t.portfolio.viewProfile}
            </Link>
            {empty > 0 && (
              <Link href="/app/portfolio/new" className="press amber-gradient inline-flex h-11 items-center gap-2 rounded-xl px-space-md text-label-lg text-primary-container shadow-md hover:brightness-105">
                <Plus className="size-5" />
                {t.portfolio.add}
              </Link>
            )}
          </>
        }
      />

      <section className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
        <div className="mb-space-lg flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
          <span className="text-label-md font-bold text-primary">{f(t.portfolio.used, { n: used, max: MAX_WORKS })}</span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high sm:w-56" role="progressbar" aria-valuemin={0} aria-valuemax={MAX_WORKS} aria-valuenow={used}>
            <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${(used / MAX_WORKS) * 100}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
          {projects.map((p) => {
            const cover = p.media.find((m) => m.role !== 'before') ?? p.media[0];
            const before = p.media.find((m) => m.role === 'before');
            return (
              <Link key={p.id} href={`/app/portfolio/${p.id}`} className="lift group flex flex-col overflow-hidden rounded-xl border border-line bg-surface-container-lowest shadow-sm">
                <div className="relative aspect-[4/3] bg-surface-container">
                  {cover && (
                    <img
                      src={(cover.kind === 'video' ? cover.posterUrl : (cover.thumbUrl ?? cover.url)) ?? undefined}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      style={cover.lqip ? { backgroundImage: `url("${cover.lqip}")`, backgroundSize: 'cover' } : undefined}
                    />
                  )}
                  {cover?.kind === 'video' && (
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="amber-gradient grid size-14 place-items-center rounded-full shadow-lg">
                        <Play className="size-6 fill-primary-container text-primary-container" />
                      </span>
                    </span>
                  )}
                  {cover && (
                    <>
                      <span className="absolute top-space-sm end-space-sm rounded-md bg-primary-container/90 px-2 py-1 text-label-sm text-white">
                        {ext(cover.mime)}
                      </span>
                      <span className="absolute top-space-sm start-space-sm rounded-md bg-surface-container-lowest/90 px-2 py-1 text-label-sm text-primary">
                        <span className="num">{size(cover.bytes)}</span>
                      </span>
                    </>
                  )}
                  {!cover && <span className="absolute inset-0 grid place-items-center text-body-sm text-on-surface-variant">{t.portfolio.media.saveFirst}</span>}
                </div>
                <div className="flex flex-1 flex-col p-space-md">
                  <h3 className="line-clamp-1 text-headline-sm text-primary">{p.title}</h3>
                  {p.description && <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">{p.description}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-space-sm text-label-sm">
                    {cityName(p.cityId) ? (
                      <span className="flex items-center gap-1 text-on-surface-variant">
                        <MapPin className="size-3.5" />
                        {cityName(p.cityId)}
                        {p.district ? ` · ${p.district}` : ''}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="flex items-center gap-2">
                      {before && <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">{t.portfolio.media.roles.before}</span>}
                      {!p.isPublished && <EyeOff className="size-4 text-muted" aria-label={t.portfolio.fields.published} />}
                      {p.verification === 'field_verified' && (
                        <span className="flex items-center gap-1 text-[#047857]">
                          <BadgeCheck className="size-4" />
                          {t.portfolio.verifiedBadge}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <Link key={`slot-${i}`} href="/app/portfolio/new" className="press flex min-h-64 flex-col items-center justify-center gap-space-sm rounded-xl border-2 border-dashed border-line-strong bg-surface-container-low p-space-lg text-center transition hover:border-accent-2 hover:bg-secondary-fixed/20">
              <span className="grid size-14 place-items-center rounded-full bg-secondary-fixed/50 text-secondary">
                <CloudUpload className="size-7" />
              </span>
              <span className="text-headline-sm text-primary">{f(t.portfolio.slot, { n: projects.length + i + 1 })}</span>
              <span className="text-body-sm text-on-surface-variant">{t.portfolio.slotHint}</span>
            </Link>
          ))}
        </div>

        <p className="mt-space-md flex items-start gap-space-xs rounded-xl bg-surface-container-low px-space-md py-space-sm text-body-sm text-on-surface-variant">
          <Info className="mt-0.5 size-4 shrink-0" />
          {empty === 0 ? t.portfolio.full : t.portfolio.quality}
        </p>
      </section>
    </div>
  );
}
