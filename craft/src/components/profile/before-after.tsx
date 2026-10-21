'use client';

import { ChevronsLeftRight } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

interface Img {
  url: string;
  lqip?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Drag, tap or use the arrow keys to compare the wall before and after. */
export function BeforeAfter({ before, after, alt }: { before: Img; after: Img; alt: string }) {
  const { t } = useI18n();
  const rtl = t.meta.dir === 'rtl';
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromPointer = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const frac = (clientX - r.left) / r.width;
    setPos(Math.max(0, Math.min(100, (rtl ? 1 - frac : frac) * 100)));
  }, [rtl]);

  const ratio = after.width && after.height ? `${after.width} / ${after.height}` : '4 / 3';
  return (
    <div
      ref={box}
      className="relative w-full touch-pan-y overflow-hidden rounded-2xl bg-surface-2 select-none"
      style={{ aspectRatio: ratio }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img src={after.url} alt={`${alt} — ${t.profile.after}`} className="absolute inset-0 size-full object-cover" style={after.lqip ? { backgroundImage: `url(${after.lqip})`, backgroundSize: 'cover' } : undefined} loading="lazy" decoding="async" draggable={false} />
      <img
        src={before.url}
        alt={`${alt} — ${t.profile.before}`}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: rtl ? `inset(0 0 0 ${100 - pos}%)` : `inset(0 ${100 - pos}% 0 0)`, ...(before.lqip ? { backgroundImage: `url(${before.lqip})`, backgroundSize: 'cover' } : {}) }}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <span className="absolute top-3 start-3 rounded-full bg-navy-900/75 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">{t.profile.before}</span>
      <span className="absolute top-3 end-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">{t.profile.after}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,.35)]" style={{ insetInlineStart: `${pos}%` }} />
      <button
        type="button"
        role="slider"
        aria-label={`${t.profile.before} / ${t.profile.after}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, Math.min(100, p + (rtl ? 5 : -5))));
          if (e.key === 'ArrowRight') setPos((p) => Math.max(0, Math.min(100, p + (rtl ? -5 : 5))));
        }}
        className="absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-navy-900 text-white shadow-lg rtl:translate-x-1/2 ltr:-translate-x-1/2"
        style={{ insetInlineStart: `${pos}%` }}
      >
        <ChevronsLeftRight className="size-5" />
      </button>
    </div>
  );
}
