'use client';

import { DataTable, type Column } from '@/components/ui/data-table';
import { useI18n } from '@/lib/i18n/client';
import { fmtDate } from '@/lib/i18n/format';

export interface AuditRowVM {
  id: string;
  createdAt: string;
  action: string;
  summary: string;
  tenant: string | null;
  tenantId: string | null;
  user: string | null;
  ip: string | null;
}

export function AuditConsole({ rows }: { rows: AuditRowVM[] }) {
  const { t, locale } = useI18n();
  const a = t.console.audit;
  const columns: Column<AuditRowVM>[] = [
    { key: 'time', header: a.time, cell: (r) => <span className="whitespace-nowrap text-sm">{fmtDate(r.createdAt, locale, true)}</span>, sort: (r) => r.createdAt, csv: (r) => r.createdAt },
    {
      key: 'summary',
      header: a.action,
      cell: (r) => (
        <span className="flex items-start gap-2">
          <span className="sev-dot mt-2" style={{ background: r.action.startsWith('admin.') ? 'var(--accent-2)' : r.action.startsWith('auth.') ? 'var(--teal)' : 'var(--accent)' }} />
          <span>{r.summary}</span>
        </span>
      ),
      csv: (r) => r.summary,
    },
    { key: 'tenant', header: a.company, cell: (r) => (r.tenantId ? <a href={`/admin/tenants/${r.tenantId}`}>{r.tenant}</a> : <span className="text-muted">{a.platform}</span>), sort: (r) => r.tenant ?? '', csv: (r) => r.tenant, hideSm: true },
    { key: 'user', header: a.user, cell: (r) => r.user ?? '—', sort: (r) => r.user ?? '', csv: (r) => r.user, hideSm: true },
    { key: 'code', header: 'code', cell: () => null, csv: (r) => r.action, csvOnly: true },
    { key: 'ip', header: 'IP', cell: () => null, csv: (r) => r.ip, csvOnly: true },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      search={(r) => `${r.summary} ${r.tenant ?? ''} ${r.user ?? ''}`}
      filters={[
        { id: 'admin', label: a.filterAdmin, predicate: (r) => r.action.startsWith('admin.') },
        { id: 'auth', label: a.filterAuth, predicate: (r) => r.action.startsWith('auth.') },
        { id: 'billing', label: a.filterBilling, predicate: (r) => r.action.startsWith('billing.') || r.action.includes('payment') || r.action.includes('subscription') || r.action.includes('plan') },
      ]}
      exportName="platform-activity"
      pageSize={30}
    />
  );
}
