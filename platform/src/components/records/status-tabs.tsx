import { X } from 'lucide-react';
import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n/ar';

export function StatusTabs({ base, current, counts, t, extra = '' }: { base: string; current: string; counts: { active: number; missing: number; archived: number }; t: Dictionary; extra?: string }) {
  const tabs = [
    ['active', t.common.active, counts.active],
    ['missing', t.common.missing, counts.missing],
    ['archived', t.common.archived, counts.archived],
  ] as const;
  return (
    <div className="ui-tabs" role="tablist">
      {tabs.map(([k, label, n]) => (
        <Link key={k} href={`${base}?status=${k}${extra}`} role="tab" aria-selected={current === k} className="ui-tab">
          {label}
          <span className="ui-tab__count">{n}</span>
        </Link>
      ))}
    </div>
  );
}

export function ActiveFilter({ label, clearHref }: { label: string; clearHref: string }) {
  return (
    <Link href={clearHref} className="ui-chip" aria-pressed="true" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>
      {label}
      <X size={14} />
    </Link>
  );
}
