'use client';

import { Infinity as InfinityIcon, Timer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

/** Time left on a share link, ticking every second, as day / hour / minute / second tiles. */
export function ShareCountdown({ expiresAt }: { expiresAt: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = expiresAt && now !== null ? Math.max(0, new Date(expiresAt).getTime() - now) : null;
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);

  if (!expiresAt) {
    return (
      <div className="share-timer share-timer--permanent">
        <InfinityIcon size={20} />
        <span>{t.share.permanent}</span>
      </div>
    );
  }
  const s = Math.floor((left ?? 0) / 1000);
  const parts = [
    [Math.floor(s / 86_400), t.share.units.days],
    [Math.floor((s % 86_400) / 3600), t.share.units.hours],
    [Math.floor((s % 3600) / 60), t.share.units.minutes],
    [s % 60, t.share.units.seconds],
  ] as const;
  const urgent = left !== null && left < 3_600_000;
  return (
    <div className={`share-timer ${urgent ? 'share-timer--urgent' : ''}`} role="timer" aria-live="off">
      <span className="share-timer__label">
        <Timer size={16} />
        {left === 0 ? t.share.expired : t.share.expiresIn}
      </span>
      <div className="share-timer__tiles">
        {parts.map(([n, unit]) => (
          <span key={unit} className="share-timer__tile">
            <b className="ui-num">{now === null ? '--' : String(n).padStart(2, '0')}</b>
            <span>{unit}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
