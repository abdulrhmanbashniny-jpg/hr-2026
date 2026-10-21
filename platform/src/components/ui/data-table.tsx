'use client';

import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';
import { normalizeArabic } from '@/lib/imports/normalize';
import { useI18n } from '@/lib/i18n/client';
import { f } from '@/lib/i18n/format';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sort?: (row: T) => string | number | null | undefined;
  csv?: (row: T) => string | number | null | undefined;
  csvHeader?: string;
  className?: string;
  hideSm?: boolean;
  /** Exported to CSV but not shown in the table. */
  csvOnly?: boolean;
}

export interface TableFilter<T> {
  id: string;
  label: string;
  predicate: (row: T) => boolean;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search?: (row: T) => string;
  filters?: TableFilter<T>[];
  initialFilters?: string[];
  pageSize?: number;
  exportName?: string;
  rowHref?: (row: T) => string | null;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (keys: Set<string>) => void;
  toolbar?: ReactNode;
  empty?: ReactNode;
  rowClassName?: (row: T) => string;
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function DataTable<T>({ rows, columns, rowKey, search, filters = [], initialFilters = [], pageSize = 25, exportName, rowHref, selectable, selected, onSelectedChange, toolbar, empty, rowClassName }: Props<T>) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState<Set<string>>(new Set(initialFilters));
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const nq = normalizeArabic(q);
    let out = rows;
    if (nq && search) out = out.filter((r) => normalizeArabic(search(r)).includes(nq));
    for (const fl of filters) if (active.has(fl.id)) out = out.filter(fl.predicate);
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sort) {
        const get = col.sort;
        out = [...out].sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          if (va === vb) return 0;
          if (va === null || va === undefined) return 1;
          if (vb === null || vb === undefined) return -1;
          return (va < vb ? -1 : 1) * sort.dir;
        });
      }
    }
    return out;
  }, [rows, q, active, sort, filters, columns, search]);

  const visible = columns.filter((c) => !c.csvOnly);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setActive(next);
    setPage(0);
  };

  const exportCsv = () => {
    const cols = columns.filter((c) => c.csv);
    const lines = [cols.map((c) => csvEscape(c.csvHeader ?? (typeof c.header === 'string' ? c.header : c.key))).join(',')];
    for (const r of filtered) lines.push(cols.map((c) => csvEscape(c.csv!(r))).join(','));
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const allOnPage = selectable && slice.length > 0 && slice.every((r) => selected?.has(rowKey(r)));
  const setSel = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) on ? next.add(k) : next.delete(k);
    onSelectedChange?.(next);
  };

  return (
    <div>
      <div className="ui-toolbar">
        {search ? (
          <label className="ui-search" style={{ width: 280, maxWidth: '100%' }}>
            <Search size={16} aria-hidden />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder={t.common.searchPlaceholder}
              aria-label={t.common.search}
            />
          </label>
        ) : null}
        {filters.map((fl) => (
          <button key={fl.id} type="button" className="ui-chip" aria-pressed={active.has(fl.id)} onClick={() => toggle(fl.id)}>
            {fl.label}
            <span className="ui-chip__count">{rows.filter(fl.predicate).length}</span>
          </button>
        ))}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {toolbar}
          {exportName ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={exportCsv}>
              <Download size={16} />
              {t.common.export}
            </button>
          ) : null}
        </div>
      </div>
      <div className="ui-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              {selectable ? (
                <th className="check-cell">
                  <input type="checkbox" className="ui-check" checked={!!allOnPage} aria-label={t.common.all} onChange={(e) => setSel(slice.map(rowKey), e.target.checked)} />
                </th>
              ) : null}
              {visible.map((c) => (
                <th key={c.key} className={`${c.className ?? ''} ${c.hideSm ? 'hide-sm' : ''}`} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  {c.sort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}
                    >
                      {c.header}
                      <span aria-hidden>{sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const key = rowKey(r);
              const href = rowHref?.(r) ?? null;
              return (
                <tr
                  key={key}
                  data-clickable={href ? '' : undefined}
                  aria-selected={selected?.has(key) || undefined}
                  className={rowClassName?.(r)}
                  onClick={(e) => {
                    if (!href) return;
                    const target = e.target as HTMLElement;
                    // Clicks inside a dialog opened from this row bubble here through the React tree.
                    if (!e.currentTarget.contains(target) || target.closest('button, a, input, select, textarea, label')) return;
                    router.push(href);
                  }}
                >
                  {selectable ? (
                    <td className="check-cell">
                      <input type="checkbox" className="ui-check" checked={!!selected?.has(key)} aria-label={key} onChange={(e) => setSel([key], e.target.checked)} />
                    </td>
                  ) : null}
                  {visible.map((c) => (
                    <td key={c.key} className={`${c.className ?? ''} ${c.hideSm ? 'hide-sm' : ''}`}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {slice.length === 0 ? <div className="ui-empty">{rows.length === 0 ? (empty ?? t.common.noData) : t.common.noResults}</div> : null}
      </div>
      {filtered.length > pageSize ? (
        <div className="ui-pager">
          <span>{f(t.common.showing, { from: current * pageSize + 1, to: Math.min(filtered.length, (current + 1) * pageSize), total: filtered.length })}</span>
          <div className="flex gap-2">
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronRight size={16} className="rtl:rotate-0 ltr:rotate-180" />
              {t.common.previous}
            </button>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              {t.common.next}
              <ChevronLeft size={16} className="rtl:rotate-0 ltr:rotate-180" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
