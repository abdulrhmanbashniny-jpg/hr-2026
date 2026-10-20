import { BUCKETS, bucketFor, type ExpiryBucket } from '@/lib/dates';

export type Matrix = Record<Exclude<ExpiryBucket, 'none'>, number> & { none: number };

export function emptyMatrix(): Matrix {
  return { expired: 0, d30: 0, d60: 0, d90: 0, valid: 0, none: 0 };
}

export function matrixOf(dates: (string | null | undefined)[], today: string): Matrix {
  const m = emptyMatrix();
  for (const d of dates) m[bucketFor(d, today)]++;
  return m;
}

export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined, fallback = '—'): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = (key(r) ?? '').trim() || fallback;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
}

/** Keeps the top N categories and folds the rest into one "other" entry. */
export function topN(list: { name: string; count: number }[], n: number, otherLabel: string) {
  if (list.length <= n) return list;
  const head = list.slice(0, n - 1);
  const rest = list.slice(n - 1).reduce((s, x) => s + x.count, 0);
  return [...head, { name: otherLabel, count: rest }];
}

export { BUCKETS };
