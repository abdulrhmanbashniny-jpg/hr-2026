'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

export interface ColumnDatum {
  label: string;
  /** Long label for the tooltip and the screen-reader table. */
  title: string;
  value: number;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Round the axis maximum up to 1, 2, 2.5 or 5 × 10ⁿ so the four ticks are clean numbers. */
function niceMax(v: number): number {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const format = (n: number) => full.format(n);

/**
 * Single-series column chart: thin columns (≤ 24px) with a rounded data end, hairline grid, a value on
 * the latest column, a tooltip on hover/focus and a hidden table for screen readers. In Arabic the
 * time axis runs right-to-left.
 */
export function ColumnChart({ data, height = 220, unit }: { data: ColumnDatum[]; height?: number; unit?: string }) {
  const { t } = useI18n();
  const rtl = t.meta.dir === 'rtl';
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padTop = 22;
  const padBottom = 26;
  const axisW = 40;
  const plotW = Math.max(0, width - axisW);
  const plotH = height - padTop - padBottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.min(24, Math.max(6, band * 0.5));
  const xOf = (i: number) => {
    const slot = rtl ? data.length - 1 - i : i;
    return (rtl ? 0 : axisW) + slot * band + band / 2;
  };
  const yOf = (v: number) => padTop + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const last = data.length - 1;

  return (
    <div ref={ref} className="chart" onMouseLeave={() => setHover(null)}>
      {width ? (
        <svg width={width} height={height} role="img" aria-hidden="true">
          {ticks.map((v) => (
            <g key={v}>
              <line className="chart__grid" x1={rtl ? 0 : axisW} x2={rtl ? plotW : width} y1={yOf(v)} y2={yOf(v)} />
              <text className="chart__axis" x={rtl ? width - 2 : axisW - 8} y={yOf(v) + 4} textAnchor={rtl ? 'end' : 'end'} style={rtl ? { direction: 'ltr' } : undefined}>
                {compact.format(v)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = xOf(i) - barW / 2;
            const y = yOf(d.value);
            const h = padTop + plotH - y;
            const r = Math.min(4, h, barW / 2);
            const path = h > 0 ? `M${x},${padTop + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padTop + plotH} Z` : '';
            const dim = hover !== null && hover !== i;
            return (
              <g key={i}>
                {path ? <path d={path} fill="var(--chart-1)" opacity={dim ? 0.45 : 1} style={{ transition: 'opacity .2s' }} /> : null}
                {(i === last || hover === i) && d.value > 0 ? (
                  <text className="chart__axis" x={xOf(i)} y={y - 7} textAnchor="middle" style={{ fill: 'var(--ink)', fontWeight: 700, direction: 'ltr' }}>
                    {compact.format(d.value)}
                  </text>
                ) : null}
                {(i % Math.ceil(data.length / 6) === 0 && last - i >= Math.ceil(data.length / 6)) || i === last ? (
                  <text className="chart__axis" x={xOf(i)} y={height - 6} textAnchor="middle">
                    {d.label}
                  </text>
                ) : null}
                <rect
                  x={xOf(i) - band / 2}
                  y={padTop}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.title}: ${format(d.value)}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  style={{ outline: 'none', cursor: 'default' }}
                />
              </g>
            );
          })}
          <line x1={rtl ? 0 : axisW} x2={rtl ? plotW : width} y1={padTop + plotH} y2={padTop + plotH} stroke="var(--line)" strokeWidth={1} />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover !== null && width ? (
        <div className="chart__tip" style={{ left: xOf(hover), top: yOf(data[hover].value) }}>
          {data[hover].title}
          <b>
            {format(data[hover].value)}
            {unit ? ` ${unit}` : ''}
          </b>
        </div>
      ) : null}
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.title}>
              <th>{d.title}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
