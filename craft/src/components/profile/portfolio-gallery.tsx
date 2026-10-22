'use client';

import { BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, Image as ImageIcon, Images, Info, MapPin, Maximize2, Play, Ruler, ShieldCheck, Video } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import type { PublicMedia, PublicProduct, PublicProject } from '@/lib/craftsmen/public';
import { f, fmtDate, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { profileStrings, type ProfileStrings } from '@/lib/i18n/pages/profile';
import { BeforeAfter } from './before-after';

const FORMAT: Record<string, string> = { jpeg: 'JPG', jpg: 'JPG', quicktime: 'MOV', 'x-m4v': 'M4V' };
function format(mime: string) {
  const sub = mime.split('/')[1]?.toLowerCase() ?? '';
  return FORMAT[sub] ?? sub.toUpperCase();
}
function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function duration(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One main photo or video per work, plus an optional "before" photo for the comparison slider. */
function split(p: PublicProject) {
  const main = p.media.find((m) => m.role !== 'before') ?? p.media[0];
  const before = p.media.find((m) => m.role === 'before' && m.kind === 'image' && m !== main);
  return { main, before: main?.kind === 'image' ? before : undefined };
}

function ProductChips({ products, s }: { products: PublicProduct[]; s: ProfileStrings }) {
  const { locale } = useI18n();
  if (!products.length) return null;
  return (
    <div className="mt-space-sm">
      <div className="mb-1.5 text-label-sm text-on-surface-variant">{s.works.products}</div>
      <ul className="flex flex-wrap gap-1.5">
        {products.map((x) => (
          <li key={x.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-container-lowest py-0.5 ps-1 pe-2.5 text-label-sm text-primary-container">
            <span className="size-4 shrink-0 rounded-full border border-black/10" style={{ background: x.swatch }} aria-hidden />
            <span className="truncate">{locale === 'ar' ? x.nameAr : x.nameEn}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MediaBox({ p, s, onOpen }: { p: PublicProject; s: ProfileStrings; onOpen: () => void }) {
  const [playing, setPlaying] = useState(false);
  const { main, before } = split(p);
  if (!main)
    return (
      <div className="grid size-full place-items-center text-on-surface-variant">
        <Images className="size-8" />
      </div>
    );
  if (main.kind === 'video') {
    if (playing) return <video src={main.url} poster={main.posterUrl ?? undefined} controls autoPlay playsInline preload="metadata" className="size-full bg-black object-contain" />;
    return (
      <button type="button" onClick={() => setPlaying(true)} className="group/play relative block size-full" aria-label={`${s.works.play}: ${p.title}`}>
        {main.posterUrl ? (
          <img src={main.posterUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" style={main.lqip ? { backgroundImage: `url(${main.lqip})`, backgroundSize: 'cover' } : undefined} />
        ) : (
          <div className="navy-gradient size-full" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-primary/30">
          <span className="grid size-14 place-items-center rounded-full bg-secondary-container text-on-secondary-fixed shadow-lg transition-transform group-hover/play:scale-110">
            <Play className="size-7 translate-x-0.5 fill-current" />
          </span>
        </span>
      </button>
    );
  }
  if (before) return <BeforeAfter before={before} after={main} alt={p.title} fill />;
  return (
    <button type="button" onClick={onOpen} className="block size-full" aria-label={`${s.works.open}: ${p.title}`}>
      <img
        src={main.thumbUrl ?? main.url}
        alt={p.title}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        style={main.lqip ? { backgroundImage: `url(${main.lqip})`, backgroundSize: 'cover' } : undefined}
      />
    </button>
  );
}

function WorkCard({ p, s, onOpen }: { p: PublicProject; s: ProfileStrings; onOpen: () => void }) {
  const { locale } = useI18n();
  const { main } = split(p);
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-low shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-56 w-full overflow-hidden bg-surface-container">
        <MediaBox p={p} s={s} onOpen={onOpen} />
        {main && (
          <>
            <span className="pointer-events-none absolute start-3 top-3 flex items-center gap-1 rounded-lg bg-primary/80 px-2.5 py-1 text-label-sm text-on-primary backdrop-blur-md">
              {main.kind === 'video' ? <Video className="size-3.5" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />}
              {f(main.kind === 'video' ? s.works.video : s.works.photo, { fmt: format(main.mime) })}
            </span>
            <span className="num pointer-events-none absolute end-3 top-3 rounded-md bg-surface-container-lowest/90 px-2 py-0.5 text-label-sm text-primary">{fileSize(main.bytes)}</span>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-space-md">
        <div>
          <div className="mb-1 flex items-start justify-between gap-space-sm">
            <h3 className="text-headline-sm text-primary">
              <button type="button" onClick={onOpen} className="text-start hover:text-secondary">
                {p.title}
              </button>
            </h3>
            <button type="button" onClick={onOpen} aria-label={s.works.open} title={s.works.open} className="press -me-1 grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary">
              <Maximize2 className="size-4" />
            </button>
          </div>
          {(p.city || p.district || p.areaSqm) && (
            <p className="mb-1 flex flex-wrap items-center gap-x-2 text-label-sm text-on-surface-variant">
              {(p.city || p.district) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 text-secondary" aria-hidden />
                  {[p.city ? (locale === 'ar' ? p.city.nameAr : p.city.nameEn) : null, p.district].filter(Boolean).join(' · ')}
                </span>
              )}
              {p.areaSqm ? (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="size-3.5 text-secondary" aria-hidden />
                  {f(s.works.area, { n: fmtNumber(p.areaSqm) })}
                </span>
              ) : null}
            </p>
          )}
          {p.description && <p className="line-clamp-3 text-body-sm text-on-surface-variant">{p.description}</p>}
          <ProductChips products={p.products} s={s} />
        </div>
        <div className="mt-space-sm flex flex-wrap items-center justify-between gap-x-space-sm gap-y-1 border-t border-line pt-space-sm text-label-sm text-on-surface-variant">
          <span>
            {main?.kind === 'video' && main.durationSec ? (
              <>
                {f(s.works.duration, { d: '' })}
                <span className="num">{duration(main.durationSec)}</span>
              </>
            ) : p.completedOn ? (
              f(s.works.completed, { date: fmtDate(p.completedOn, locale) })
            ) : null}
          </span>
          {p.fieldVerified ? (
            <span className="inline-flex items-center gap-1 font-semibold text-secondary">
              <BadgeCheck className="size-4" aria-hidden />
              {s.works.verified}
            </span>
          ) : (
            <span>{s.works.self}</span>
          )}
        </div>
      </div>
    </article>
  );
}

function Lightbox({ projects, index, onIndex, onClose, s }: { projects: PublicProject[]; index: number | null; onIndex: (i: number) => void; onClose: () => void; s: ProfileStrings }) {
  const { locale } = useI18n();
  const p = index === null ? null : projects[index];
  const n = projects.length;
  const Prev = locale === 'ar' ? ChevronRight : ChevronLeft;
  const Next = locale === 'ar' ? ChevronLeft : ChevronRight;
  const { main, before } = p ? split(p) : { main: undefined, before: undefined };
  return (
    <Dialog
      open={p !== null}
      onClose={onClose}
      title={p?.title ?? ''}
      wide
      footer={
        n > 1 && index !== null ? (
          <div className="flex w-full items-center justify-between gap-space-sm">
            <button type="button" onClick={() => onIndex((index - 1 + n) % n)} className="press inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface-container-lowest px-3 text-label-md text-primary hover:bg-surface-container-low">
              <Prev className="size-4" aria-hidden />
              {s.works.prev}
            </button>
            <span className="text-label-md text-on-surface-variant">{f(s.works.of, { i: index + 1, n })}</span>
            <button type="button" onClick={() => onIndex((index + 1) % n)} className="press inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface-container-lowest px-3 text-label-md text-primary hover:bg-surface-container-low">
              {s.works.next}
              <Next className="size-4" aria-hidden />
            </button>
          </div>
        ) : undefined
      }
    >
      {p && (
        <div className="space-y-space-md">
          {main ? (
            main.kind === 'video' ? (
              <video key={main.id} src={main.url} poster={main.posterUrl ?? undefined} controls playsInline preload="metadata" className="max-h-[60dvh] w-full rounded-xl bg-black" />
            ) : before ? (
              <div>
                <BeforeAfter key={main.id} before={before} after={main} alt={p.title} />
                <p className="mt-space-xs text-center text-body-sm text-on-surface-variant">{s.works.compare}</p>
              </div>
            ) : (
              <img key={main.id} src={main.url} alt={p.title} className="max-h-[60dvh] w-full rounded-xl bg-surface-container object-contain" style={main.lqip ? { backgroundImage: `url(${main.lqip})`, backgroundSize: 'cover' } : undefined} />
            )
          ) : null}
          <div className="flex flex-wrap items-center gap-x-space-md gap-y-space-xs text-label-md text-on-surface-variant">
            {p.fieldVerified ? (
              <span className="inline-flex h-[26px] items-center gap-1 rounded-md bg-[rgb(16_185_129/0.1)] px-2.5 text-label-sm text-[#047857]">
                <BadgeCheck className="size-3.5" aria-hidden />
                {s.works.verified}
              </span>
            ) : (
              <span className="inline-flex h-[26px] items-center rounded-md bg-surface-container px-2.5 text-label-sm">{s.works.self}</span>
            )}
            {(p.city || p.district) && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4 text-secondary" aria-hidden />
                {[p.city ? (locale === 'ar' ? p.city.nameAr : p.city.nameEn) : null, p.district].filter(Boolean).join(' · ')}
              </span>
            )}
            {p.completedOn && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4 text-secondary" aria-hidden />
                {fmtDate(p.completedOn, locale)}
              </span>
            )}
            {p.areaSqm ? (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-4 text-secondary" aria-hidden />
                {f(s.works.area, { n: fmtNumber(p.areaSqm) })}
              </span>
            ) : null}
            {p.warrantyMonths ? (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-4 text-secondary" aria-hidden />
                {f(s.works.warranty, { n: p.warrantyMonths })}
              </span>
            ) : null}
            {main && (
              <span className="inline-flex items-center gap-1">
                {main.kind === 'video' ? <Video className="size-4 text-secondary" aria-hidden /> : <ImageIcon className="size-4 text-secondary" aria-hidden />}
                {f(main.kind === 'video' ? s.works.video : s.works.photo, { fmt: format(main.mime) })} · <span className="num">{fileSize(main.bytes)}</span>
                {main.kind === 'video' && main.durationSec ? (
                  <>
                    {' '}
                    · <span className="num">{duration(main.durationSec)}</span>
                  </>
                ) : null}
              </span>
            )}
          </div>
          {p.description && <p className="text-body-lg text-on-surface">{p.description}</p>}
          {p.products.length > 0 && (
            <div>
              <div className="mb-space-xs text-label-md font-semibold text-primary-container">{s.works.products}</div>
              <ul className="grid gap-space-xs sm:grid-cols-2">
                {p.products.map((x) => (
                  <li key={x.id} className="flex items-center gap-space-sm rounded-xl border border-line bg-surface-container-lowest p-space-xs">
                    {x.imageUrl ? (
                      <img src={x.imageUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg bg-surface-container object-cover" />
                    ) : (
                      <span className="size-12 shrink-0 rounded-lg border border-black/10" style={{ background: x.swatch }} aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 text-label-md text-primary-container">{locale === 'ar' ? x.nameAr : x.nameEn}</span>
                    <span className="me-1 size-5 shrink-0 rounded-full border border-black/10" style={{ background: x.swatch }} aria-hidden />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.colors.length > 0 && (
            <div>
              <div className="mb-space-xs text-label-md font-semibold text-primary-container">{s.works.colors}</div>
              <div className="flex flex-wrap gap-space-xs">
                {p.colors.map((c) => (
                  <span key={c.hex + c.name} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-container-low py-1 ps-1 pe-3 text-label-sm text-on-surface">
                    <span className="size-5 rounded-full border border-black/10" style={{ background: c.hex }} aria-hidden />
                    {c.name}
                    {c.code && <span className="num text-on-surface-variant">{c.code}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** "معرض الأعمال والمشاريع المنجزة": up to three works, each a card with its media, facts and the factory products used. */
export function PortfolioGallery({ projects }: { projects: PublicProject[] }) {
  const { locale } = useI18n();
  const s = profileStrings(locale);
  const [open, setOpen] = useState<number | null>(null);
  const verified = projects.filter((p) => p.fieldVerified).length;

  return (
    <section className="mb-space-lg rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg" aria-labelledby="works-title">
      <div className="mb-space-lg flex flex-col justify-between gap-space-md md:flex-row md:items-center">
        <div>
          <div className="mb-1 flex items-center gap-space-xs">
            <Images className="size-6 shrink-0 text-secondary" aria-hidden />
            <h2 id="works-title" className="text-headline-md text-primary">
              {s.works.title}
            </h2>
          </div>
          <p className="max-w-2xl text-body-md text-on-surface-variant">{s.works.subtitle}</p>
        </div>
        {projects.length > 0 && (
          <div className="flex flex-col items-start md:items-end">
            <span className="mb-1.5 text-label-md font-bold text-primary">{f(s.works.meter, { v: verified, n: projects.length })}</span>
            <div className="h-2 w-48 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuemin={0} aria-valuemax={projects.length} aria-valuenow={verified}>
              <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${(verified / projects.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-container-low px-space-lg py-space-xl text-center">
          <div className="mb-space-md grid size-16 place-items-center rounded-full bg-secondary-fixed/50 text-secondary">
            <Images className="size-8" />
          </div>
          <p className="mb-1 text-headline-sm text-primary">{s.works.empty}</p>
          <p className="max-w-xs text-body-sm text-on-surface-variant">{s.works.emptyBody}</p>
        </div>
      ) : (
        <div className={cn('mb-space-md grid grid-cols-1 gap-space-md md:grid-cols-2', projects.length > 2 && 'lg:grid-cols-3')}>
          {projects.map((p, i) => (
            <WorkCard key={p.id} p={p} s={s} onOpen={() => setOpen(i)} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-space-xs rounded-xl bg-surface-container-low p-space-sm text-on-surface-variant">
        <Info className="mt-0.5 size-[18px] shrink-0 text-secondary" aria-hidden />
        <p className="text-body-sm">{s.works.note}</p>
      </div>

      <Lightbox projects={projects} index={open} onIndex={setOpen} onClose={() => setOpen(null)} s={s} />
    </section>
  );
}
