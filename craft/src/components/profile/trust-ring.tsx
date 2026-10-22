'use client';

import { motion } from 'motion/react';
import { useI18n } from '@/lib/i18n/client';
import { trustBand, type TrustPart } from '@/lib/trust';

export function TrustRing({ score, size = 112 }: { score: number; size?: number }) {
  const { t } = useI18n();
  const r = 44;
  const c = 2 * Math.PI * r;
  const band = trustBand(score);
  const color = band === 'excellent' ? '#059669' : band === 'strong' ? '#F59E0B' : band === 'growing' ? '#486581' : '#9FB3C8';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${t.trust.title}: ${score}/100 — ${t.trust.bands[band]}`}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * score) / 100 }}
          transition={{ type: 'spring', stiffness: 60, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="num text-2xl font-semibold text-ink">{score}</div>
          <div className="text-[11px] font-medium" style={{ color }}>
            {t.trust.bands[band]}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrustBreakdown({ parts, showTips = false }: { parts: TrustPart[]; showTips?: boolean }) {
  const { t } = useI18n();
  return (
    <ul className="space-y-2.5">
      {parts.map((p) => (
        <li key={p.key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-ink-2">{t.trust.parts[p.key]}</span>
            <span className="num text-xs text-muted">
              {p.points}/{p.max}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-navy-900 dark:bg-navy-200" initial={{ width: 0 }} animate={{ width: `${(p.points / p.max) * 100}%` }} />
          </div>
          {showTips && p.points < p.max && <p className="mt-1 text-xs text-muted">{t.trust.tips[p.key]}</p>}
        </li>
      ))}
    </ul>
  );
}
