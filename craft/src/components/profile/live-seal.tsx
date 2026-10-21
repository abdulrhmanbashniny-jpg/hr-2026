'use client';

import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

/**
 * A verification seal that is visibly alive: the guilloche ring turns and the Riyadh clock ticks
 * every second. A screenshot of a profile freezes both, so it cannot pass for the live page.
 */
export function LiveSeal({ code }: { code: string }) {
  const { t, locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
    : '--:--:--';
  const date = now ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', year: 'numeric' }).format(now) : '';

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-sm" title={t.profile.liveSealHint}>
      <div className="relative size-14 shrink-0">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" style={{ animation: 'seal-spin 18s linear infinite' }} aria-hidden>
          <defs>
            <path id={`seal-${code}`} d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
          </defs>
          {Array.from({ length: 36 }, (_, i) => (
            <ellipse key={i} cx="50" cy="50" rx="44" ry="18" fill="none" stroke="#F59E0B" strokeOpacity=".35" strokeWidth=".6" transform={`rotate(${i * 5} 50 50)`} />
          ))}
          <text fontSize="8.5" fill="#B45309" fontWeight="600" letterSpacing="2">
            <textPath href={`#seal-${code}`}>HIRFA · VERIFIED · {code} · HIRFA · VERIFIED · </textPath>
          </text>
        </svg>
        <div className="absolute inset-[22%] grid place-items-center rounded-full bg-navy-900 text-accent-2 shadow-md">
          <ShieldCheck className="size-5" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <span className="size-2 rounded-full bg-success" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }} />
          {t.profile.liveSeal}
        </div>
        <div className="num text-lg font-semibold text-ink" aria-live="off">
          {time}
        </div>
        <div className="text-[11px] text-muted">{date}</div>
      </div>
    </div>
  );
}
