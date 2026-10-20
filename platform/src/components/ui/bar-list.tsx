import { fmtNumber } from '@/lib/i18n/format';

const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];

/** Horizontal bars for categorical counts (nationalities, occupations…). Pure CSS, server-rendered. */
export function BarList({ items, max = 7, otherLabel, format = (n: number) => fmtNumber(n), single }: { items: { name: string; count: number }[]; max?: number; otherLabel: string; format?: (n: number) => string; single?: boolean }) {
  const list = items.length > max ? [...items.slice(0, max - 1), { name: otherLabel, count: items.slice(max - 1).reduce((s, x) => s + x.count, 0) }] : items;
  const top = Math.max(1, ...list.map((x) => x.count));
  return (
    <div className="bar-list">
      {list.map((x, i) => (
        <div key={x.name} className="bar-list__row">
          <span className="truncate" title={x.name}>
            {x.name}
          </span>
          <span className="bar-list__track">
            <span className="bar-list__fill block" style={{ width: `${(x.count / top) * 100}%`, background: single ? SERIES[0] : SERIES[Math.min(i, SERIES.length - 1)] }} />
          </span>
          <span className="ui-num text-sm font-semibold">{format(x.count)}</span>
        </div>
      ))}
    </div>
  );
}
