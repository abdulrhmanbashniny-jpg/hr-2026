'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

interface Row {
  month: string;
  signups: number;
  confirmed: number;
}

/**
 * Two series on one axis (members and confirmed referrals are both counts): navy and amber lines,
 * a soft area under the first, hairline grid, a crosshair with a tooltip, and a table for screen readers.
 */
export function MonthlyChart({ rows, labels }: { rows: Row[]; labels: { signups: string; confirmed: string; month: string } }) {
  const { locale } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 240;
  const pad = { t: 16, r: 16, b: 32, l: 36 };
  const max = Math.max(4, ...rows.flatMap((r) => [r.signups, r.confirmed]));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const rtl = locale === 'ar';
  const x = (i: number) => {
    const t = rows.length > 1 ? i / (rows.length - 1) : 0.5;
    return pad.l + (rtl ? 1 - t : t) * (W - pad.l - pad.r);
  };
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { month: 'long' });
  const name = (m: string) => fmt.format(new Date(`${m}-15T00:00:00Z`));
  const line = (key: 'signups' | 'confirmed') => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ');
  const area = `${line('signups')} L${x(rows.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  return (
    <div>
      <div className="mb-space-sm flex flex-wrap items-center gap-space-md text-label-md text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-primary-container" />
          {labels.signups}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-accent" />
          {labels.confirmed}
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${labels.signups} · ${labels.confirmed}`} onPointerLeave={() => setHover(null)}>
          {[0, 1, 2, 3, 4].map((g) => (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={y(g * step)} y2={y(g * step)} stroke="var(--grid)" strokeWidth={1} />
              <text x={rtl ? W - pad.r + 4 : pad.l - 8} y={y(g * step) + 4} textAnchor={rtl ? 'start' : 'end'} fontSize={11} fill="var(--muted)" className="num">
                {g * step}
              </text>
            </g>
          ))}
          <path d={area} fill="rgb(245 158 11 / 0.08)" />
          <path d={line('signups')} fill="none" stroke="var(--primary-container)" strokeWidth={2} strokeLinejoin="round" />
          <path d={line('confirmed')} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
          {rows.map((r, i) => (
            <g key={r.month}>
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {name(r.month)}
              </text>
              <circle cx={x(i)} cy={y(r.signups)} r={hover === i ? 5 : 3.5} fill="var(--primary-container)" stroke="var(--surface-container-lowest)" strokeWidth={2} />
              <circle cx={x(i)} cy={y(r.confirmed)} r={hover === i ? 5 : 3.5} fill="var(--accent)" stroke="var(--surface-container-lowest)" strokeWidth={2} />
              <rect x={x(i) - (W - pad.l - pad.r) / rows.length / 2} y={pad.t} width={(W - pad.l - pad.r) / rows.length} height={H - pad.t - pad.b} fill="transparent" onPointerEnter={() => setHover(i)} />
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="3 3" />}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-2 rounded-lg bg-primary-container px-3 py-2 text-label-sm text-white shadow-lg" style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 140px))` }}>
            <div className="mb-1 font-semibold">{name(rows[hover].month)}</div>
            <div className="flex items-center justify-between gap-3">
              <span>{labels.signups}</span>
              <span className="num">{rows[hover].signups}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-secondary-fixed-dim">
              <span>{labels.confirmed}</span>
              <span className="num">{rows[hover].confirmed}</span>
            </div>
          </div>
        )}
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>{labels.month}</th>
            <th>{labels.signups}</th>
            <th>{labels.confirmed}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{name(r.month)}</td>
              <td>{r.signups}</td>
              <td>{r.confirmed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
