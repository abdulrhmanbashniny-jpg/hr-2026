'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { KSA_PATH, KSA_VIEWBOX, project } from '@/lib/geo/ksa';
import { fmtCompact, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

/* Hand-built SVG charts. One axis per chart, hairline solid grid, 2px lines with a 10% area wash,
   crosshair + tooltip on hover and keyboard focus, and a table view for screen readers. Text uses
   text tokens; only marks carry series colour. */

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

function niceMax(v: number): number {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function dayLabel(day: string, locale: 'ar' | 'en') {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
}

export function TimeSeriesChart({ days, series, height = 220, area = true }: { days: string[]; series: Series[]; height?: number; area?: boolean }) {
  const { locale } = useI18n();
  const c = useConsole();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = { top: 16, right: 40, bottom: 26, left: 8 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = [0, max / 2, max];
  const x = (i: number) => pad.left + (i / Math.max(1, days.length - 1)) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (1 - v / max) * (H - pad.top - pad.bottom);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');

  function onMove(clientX: number) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const fx = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((fx - pad.left) / (W - pad.left - pad.right)) * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, i)));
  }

  return (
    <div className="relative" dir="ltr">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div
        ref={box}
        tabIndex={0}
        role="img"
        aria-label={series.map((s) => s.label).join(' / ')}
        className="relative touch-pan-y outline-none"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? days.length) - 1));
          if (e.key === 'ArrowRight') setHover((h) => Math.min(days.length - 1, (h ?? -1) + 1));
        }}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={pad.left} x2={W - pad.right} y1={y(tk)} y2={y(tk)} stroke="var(--grid)" strokeWidth={1} />
              <text x={W - pad.right + 6} y={y(tk) + 4} fontSize={11} fill="var(--muted)" className="num">
                {fmtCompact(tk)}
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            (i % 7 === 0 && days.length - 1 - i >= 4) || i === days.length - 1 ? (
              <text key={d} x={x(i)} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}>
                {dayLabel(d, locale)}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <g key={s.key}>
              {area && series.length === 1 && <path d={`${path(s.values)}L${x(s.values.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} fill={s.color} opacity={0.1} />}
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1] ?? 0)} r={4} fill={s.color} stroke="var(--surface-container-lowest)" strokeWidth={2} />
            </g>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={H - pad.bottom} stroke="var(--line-strong)" strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="var(--surface-container-lowest)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="glass pointer-events-none absolute top-2 z-10 min-w-32 rounded-xl px-3 py-2 text-xs shadow-md"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) / W > 0.6 ? 'calc(-100% - 12px)' : '12px'})` }}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
          >
            <div className="mb-1 text-muted">{dayLabel(days[hover], locale)}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="num font-semibold text-ink">{fmtNumber(s.values[hover])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <table className="sr-only" aria-labelledby={id}>
        <caption id={id}>{c.charts.table}</caption>
        <thead>
          <tr>
            <th>{c.charts.day}</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <td>{d}</td>
              {series.map((s) => (
                <td key={s.key}>{s.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal bars: capped at 20 px thick, rounded at the data end, value at the tip. */
export function BarList({ rows, color = 'var(--series-1)' }: { rows: { label: string; value: number; hint?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm" title={r.hint}>
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-5 rounded-e-[4px]" style={{ width: `${Math.max(2, (r.value / max) * 85)}%`, background: color }} />
            <span className="num text-xs font-semibold text-ink">{fmtNumber(r.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface MapCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  craftsmen: number;
  active: number;
  invoices: number;
}

const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];

/** Bubble density map: area ∝ craftsmen, one-hue sequential fill ∝ share active. */
export function KsaMap({ cities, labelTop = 6 }: { cities: MapCity[]; labelTop?: number }) {
  const c = useConsole();
  const { locale } = useI18n();
  const [hover, setHover] = useState<MapCity | null>(null);
  const max = Math.max(1, ...cities.map((x) => x.craftsmen));
  const placed = useMemo(
    () =>
      cities
        .filter((x) => x.craftsmen > 0)
        .map((x) => ({ ...x, ...project(x.lng, x.lat), r: 7 + Math.sqrt(x.craftsmen / max) * 38, share: x.craftsmen ? x.active / x.craftsmen : 0 }))
        .sort((a, b) => b.r - a.r),
    [cities, max],
  );
  // Label the biggest cities, skipping any label that would collide with one already placed.
  const top = new Set<string>();
  const taken: { x: number; y: number }[] = [];
  for (const p of placed) {
    if (top.size >= labelTop) break;
    const ly = p.y + p.r + 16;
    if (taken.some((q) => Math.abs(q.x - p.x) < 90 && Math.abs(q.y - ly) < 26)) continue;
    taken.push({ x: p.x, y: ly });
    top.add(p.id);
  }
  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${KSA_VIEWBOX.width} ${KSA_VIEWBOX.height}`} className="w-full" role="img" aria-label={c.map.title}>
        <path d={KSA_PATH} fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={1.5} strokeLinejoin="round" />
        {placed.map((p) => (
          <g key={p.id} tabIndex={0} onPointerEnter={() => setHover(p)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(p)} onBlur={() => setHover(null)} className="cursor-pointer outline-none">
            <circle cx={p.x} cy={p.y} r={Math.max(p.r, 14)} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={p.r} fill={SEQ[Math.min(4, Math.floor(p.share * 5))]} fillOpacity={hover?.id === p.id ? 1 : 0.85} stroke="var(--surface-container-lowest)" strokeWidth={2} />
            {top.has(p.id) && (
              <text x={p.x} y={p.y + p.r + 16} textAnchor="middle" fontSize={18} fontWeight={600} fill="var(--ink)" style={{ paintOrder: 'stroke', stroke: 'var(--surface-container-lowest)', strokeWidth: 4 }}>
                {p.name}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover && (
        <div className="glass pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-xs shadow-md" style={{ left: `${(project(hover.lng, hover.lat).x / KSA_VIEWBOX.width) * 100}%`, top: `${(project(hover.lng, hover.lat).y / KSA_VIEWBOX.height) * 100}%`, transform: 'translate(-50%, calc(-100% - 18px))' }} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <div className="mb-1 font-semibold text-ink">{hover.name}</div>
          <div className="text-ink-2">
            <span className="num font-semibold text-ink">{fmtNumber(hover.craftsmen)}</span> {c.map.craftsmen} · <span className="num font-semibold text-ink">{fmtNumber(hover.active)}</span> {c.map.active}
          </div>
          <div className="text-ink-2">
            <span className="num font-semibold text-ink">{fmtNumber(hover.invoices)}</span> {c.map.invoices}
          </div>
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <span>0%</span>
        <div className="flex overflow-hidden rounded-full">
          {SEQ.map((s) => (
            <span key={s} className="h-2 w-8" style={{ background: s }} />
          ))}
        </div>
        <span>100% {c.map.active}</span>
      </div>
      <table className="sr-only">
        <caption>{c.map.title}</caption>
        <tbody>
          {cities.map((x) => (
            <tr key={x.id}>
              <td>{x.name}</td>
              <td>{x.craftsmen}</td>
              <td>{x.active}</td>
              <td>{x.invoices}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
