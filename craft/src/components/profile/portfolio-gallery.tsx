'use client';

import { BadgeCheck, CalendarDays, Images, MapPin, Ruler } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/card';
import type { PublicMedia, PublicProject } from '@/lib/craftsmen/public';
import { fmtDate, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { BeforeAfter } from './before-after';

function MediaTile({ m, onOpen, className }: { m: PublicMedia; onOpen: () => void; className?: string }) {
  const src = m.kind === 'video' ? m.posterUrl : (m.thumbUrl ?? m.url);
  return (
    <button type="button" onClick={onOpen} className={`group relative overflow-hidden rounded-xl bg-surface-2 ${className ?? ''}`}>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          style={m.lqip ? { backgroundImage: `url(${m.lqip})`, backgroundSize: 'cover' } : undefined}
        />
      ) : (
        <div className="grid size-full place-items-center text-muted">
          <Images className="size-6" />
        </div>
      )}
      {m.kind === 'video' && <span className="absolute inset-0 grid place-items-center bg-navy-950/20 text-3xl text-white">▶</span>}
    </button>
  );
}

export function PortfolioGallery({ projects }: { projects: PublicProject[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<{ project: PublicProject; index: number } | null>(null);
  if (!projects.length) return <EmptyState icon={<Images className="size-6" />} title={t.profile.noProjects} />;

  return (
    <div className="space-y-6">
      {projects.map((p) => {
        const before = p.media.find((m) => m.role === 'before' && m.kind === 'image');
        const after = p.media.find((m) => m.role === 'after' && m.kind === 'image');
        const rest = p.media.filter((m) => m !== before && m !== after);
        return (
          <article key={p.id} className="surface overflow-hidden">
            {before && after ? (
              <div className="p-3 pb-0">
                <BeforeAfter before={before} after={after} alt={p.title} />
              </div>
            ) : null}
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-lg font-semibold">{p.title}</h3>
                {p.fieldVerified ? (
                  <Badge tone="success" icon={<BadgeCheck className="size-3.5" />}>
                    {t.profile.fieldVerified}
                  </Badge>
                ) : (
                  <Badge>{t.profile.selfReported}</Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                {p.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {locale === 'ar' ? p.city.nameAr : p.city.nameEn}
                    {p.district ? ` · ${p.district}` : ''}
                  </span>
                )}
                {p.completedOn && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {fmtDate(p.completedOn, locale)}
                  </span>
                )}
                {p.areaSqm && (
                  <span className="inline-flex items-center gap-1">
                    <Ruler className="size-3.5" />
                    <span className="num">{fmtNumber(p.areaSqm)}</span> {t.profile.sqm}
                  </span>
                )}
                {p.brand && <span>{locale === 'ar' ? p.brand.nameAr : p.brand.name}</span>}
              </div>
              {p.description && <p className="mt-3 text-sm leading-relaxed text-ink-2">{p.description}</p>}
              {p.colors.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium text-muted">{t.profile.colors}</div>
                  <div className="flex flex-wrap gap-2">
                    {p.colors.map((c) => (
                      <span key={c.hex + c.name} className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas py-1 ps-1 pe-3 text-xs">
                        <span className="size-5 rounded-full border border-black/10" style={{ background: c.hex }} />
                        {c.name}
                        {c.code && <span className="num text-faint">{c.code}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {rest.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {rest.map((m) => (
                    <MediaTile key={m.id} m={m} className="aspect-square" onOpen={() => setOpen({ project: p, index: p.media.indexOf(m) })} />
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.project.title ?? ''} wide>
        {open && (
          <div className="space-y-3">
            {(() => {
              const m = open.project.media[open.index];
              return m.kind === 'video' ? (
                <video src={m.url} poster={m.posterUrl ?? undefined} controls playsInline preload="metadata" className="w-full rounded-xl bg-black" />
              ) : (
                <img src={m.url} alt="" className="w-full rounded-xl" style={m.lqip ? { backgroundImage: `url(${m.lqip})`, backgroundSize: 'cover' } : undefined} />
              );
            })()}
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {open.project.media.map((m, i) => (
                <MediaTile key={m.id} m={m} className={`size-16 shrink-0 ${i === open.index ? 'ring-2 ring-accent' : ''}`} onOpen={() => setOpen({ ...open, index: i })} />
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
