'use client';

import { Avatar } from '@/components/app/topbar';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useI18n } from '@/lib/i18n/client';
import { fmtDate } from '@/lib/i18n/format';

export interface UserRowVM {
  id: string;
  name: string;
  email: string;
  companies: string[];
  isSuperAdmin: boolean;
  disabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function UsersTable({ rows }: { rows: UserRowVM[] }) {
  const { t, locale } = useI18n();
  const c = t.console.users;
  const columns: Column<UserRowVM>[] = [
    {
      key: 'user',
      header: c.user,
      cell: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.name} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{r.name}</span>
            <span className="ltr block truncate text-xs text-muted" style={{ textAlign: 'start' }}>
              {r.email}
            </span>
          </span>
        </span>
      ),
      sort: (r) => r.name,
      csv: (r) => r.name,
    },
    { key: 'email', header: c.email, cell: () => null, csv: (r) => r.email, csvOnly: true },
    { key: 'companies', header: c.companies, cell: (r) => (r.companies.length ? <span className="truncate-2 text-sm">{r.companies.join('، ')}</span> : <span className="text-muted">—</span>), sort: (r) => r.companies.length, csv: (r) => r.companies.join(' | '), hideSm: true },
    {
      key: 'status',
      header: c.status,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.disabled ? <span className="ui-pill ui-pill--red ui-pill--dot">{c.disabled}</span> : <span className="ui-pill ui-pill--green ui-pill--dot">{c.active}</span>}
          {r.isSuperAdmin ? <span className="ui-pill ui-pill--blue">{c.superAdmin}</span> : null}
        </span>
      ),
      sort: (r) => (r.disabled ? 1 : 0),
      csv: (r) => `${r.disabled ? 'disabled' : 'active'}${r.isSuperAdmin ? ' admin' : ''}`,
    },
    { key: 'login', header: c.lastLogin, cell: (r) => <span className="whitespace-nowrap text-sm">{r.lastLoginAt ? fmtDate(r.lastLoginAt, locale, true) : <span className="text-muted">{c.never}</span>}</span>, sort: (r) => r.lastLoginAt ?? '', csv: (r) => r.lastLoginAt, hideSm: true },
    { key: 'created', header: c.created, cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.createdAt, locale)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt.slice(0, 10), hideSm: true },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowHref={(r) => `/admin/users/${r.id}`}
      search={(r) => `${r.name} ${r.email} ${r.companies.join(' ')}`}
      filters={[
        { id: 'admins', label: c.filterAdmins, predicate: (r) => r.isSuperAdmin },
        { id: 'disabled', label: c.filterDisabled, predicate: (r) => r.disabled },
        { id: 'never', label: c.filterNever, predicate: (r) => !r.lastLoginAt },
      ]}
      exportName="users"
      pageSize={25}
    />
  );
}
