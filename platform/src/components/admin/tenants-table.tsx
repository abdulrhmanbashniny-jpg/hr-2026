'use client';

import { Avatar } from '@/components/app/topbar';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useI18n } from '@/lib/i18n/client';
import { dayCount, fmtDate } from '@/lib/i18n/format';
import { StatusPill, type SubStatusKey } from './status';

export interface TenantVM {
  id: string;
  name: string;
  crNumber: string | null;
  createdAt: string;
  status: SubStatusKey;
  plan: string | null;
  cycle: 'monthly' | 'yearly' | null;
  renewalAt: string | null;
  daysLeft: number | null;
  members: number;
  records: number;
  lastActive: string | null;
  suspended: boolean;
  owner: string | null;
}

export function TenantsTable({ rows }: { rows: TenantVM[] }) {
  const { t, locale } = useI18n();
  const c = t.console.tenants;
  const columns: Column<TenantVM>[] = [
    {
      key: 'name',
      header: c.company,
      cell: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{r.name}</span>
            <span className="block truncate text-xs text-muted">{r.owner ?? r.crNumber ?? '—'}</span>
          </span>
        </span>
      ),
      sort: (r) => r.name,
      csv: (r) => r.name,
    },
    { key: 'cr', header: c.crNumber, cell: () => null, csv: (r) => r.crNumber, csvOnly: true },
    {
      key: 'status',
      header: c.status,
      cell: (r) => <StatusPill status={r.suspended ? 'suspended' : r.status} label={r.suspended ? t.console.status.suspended : t.console.status[r.status]} />,
      sort: (r) => (r.suspended ? 'z' : r.status),
      csv: (r) => (r.suspended ? 'suspended' : r.status),
    },
    { key: 'plan', header: c.plan, cell: (r) => <span className="whitespace-nowrap">{r.plan ? `${r.plan}${r.cycle ? ` · ${t.console.cycle[r.cycle]}` : ''}` : '—'}</span>, sort: (r) => r.plan ?? '', csv: (r) => r.plan, hideSm: true },
    {
      key: 'renewal',
      header: c.renewal,
      cell: (r) =>
        r.renewalAt ? (
          <span className="flex flex-col">
            <span className="whitespace-nowrap">{fmtDate(r.renewalAt, locale)}</span>
            {r.daysLeft !== null ? <span className={`text-xs ${r.daysLeft <= 7 ? 'font-semibold' : 'text-muted'}`} style={r.daysLeft <= 7 ? { color: 'var(--red-ink)' } : undefined}>{r.daysLeft < 0 ? t.console.status.expired : dayCount(r.daysLeft, locale)}</span> : null}
          </span>
        ) : (
          '—'
        ),
      sort: (r) => r.renewalAt ?? '9999',
      csv: (r) => r.renewalAt?.slice(0, 10),
      hideSm: true,
    },
    { key: 'members', header: c.users, cell: (r) => <span className="ui-num">{r.members}</span>, sort: (r) => r.members, csv: (r) => r.members, hideSm: true },
    { key: 'records', header: c.records, cell: (r) => <span className="ui-num">{r.records.toLocaleString('en')}</span>, sort: (r) => r.records, csv: (r) => r.records, hideSm: true },
    { key: 'created', header: c.created, cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.createdAt, locale)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt.slice(0, 10), hideSm: true },
    { key: 'active', header: c.lastActive, cell: (r) => <span className="whitespace-nowrap text-sm">{r.lastActive ? fmtDate(r.lastActive, locale, true) : '—'}</span>, sort: (r) => r.lastActive ?? '', csv: (r) => r.lastActive, hideSm: true },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHref={(r) => `/admin/tenants/${r.id}`}
      search={(r) => `${r.name} ${r.crNumber ?? ''} ${r.owner ?? ''}`}
      filters={[
        { id: 'trial', label: c.filterTrial, predicate: (r) => r.status === 'trialing' },
        { id: 'active', label: c.filterActive, predicate: (r) => r.status === 'active' },
        { id: 'pastdue', label: c.filterPastDue, predicate: (r) => r.status === 'past_due' },
        { id: 'ended', label: c.filterEnded, predicate: (r) => r.status === 'expired' || r.status === 'canceled' },
        { id: 'suspended', label: c.filterSuspended, predicate: (r) => r.suspended },
      ]}
      exportName="companies"
      pageSize={20}
    />
  );
}
