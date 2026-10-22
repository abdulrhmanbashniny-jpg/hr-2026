'use client';

import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { profileStrings } from '@/lib/i18n/pages/profile';

/**
 * A verification seal that is visibly alive: the guilloche ring turns and the Riyadh clock ticks
 * every second. A screenshot of a profile freezes both, so it cannot pass for the live page.
 */
export function LiveSeal({ code }: { code: string }) {
  const { t, locale } = useI18n();
  const s = profileStrings(locale);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
    : '--:--:--';
  const date = now ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now) : ' ';

  return (
    <div className="flex items-center gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm" title={t.profile.liveSealHint}>
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" style={{ animation: 'seal-spin 18s linear infinite' }} aria-hidden>
          <defs>
            <path id={`seal-${code}`} d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
          </defs>
          {Array.from({ length: 36 }, (_, i) => (
            <ellipse key={i} cx="50" cy="50" rx="44" ry="18" fill="none" stroke="#F59E0B" strokeOpacity=".35" strokeWidth=".6" transform={`rotate(${i * 5} 50 50)`} />
          ))}
          <text fontSize="7.2" fill="#795900" fontWeight="600" letterSpacing="1.6">
            <textPath href={`#seal-${code}`}>{f(s.seal.ring, { code })}</textPath>
          </text>
        </svg>
        <div className="absolute inset-[24%] grid place-items-center rounded-full bg-primary-container text-secondary-fixed-dim shadow-md">
          <ShieldCheck className="size-5" />
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-label-md font-semibold text-success">
          <span className="size-2 rounded-full bg-success" style={{ animation: 'pulse-dot 1s ease-in-out infinite' }} />
          {t.profile.liveSeal}
        </div>
        <div className="num text-headline-md font-semibold text-primary" aria-live="off">
          {time}
        </div>
        <div className="text-body-sm text-on-surface-variant">{date}</div>
        <p className="mt-1 text-body-sm text-on-surface-variant">{t.profile.liveSealHint}</p>
      </div>
    </div>
  );
}
