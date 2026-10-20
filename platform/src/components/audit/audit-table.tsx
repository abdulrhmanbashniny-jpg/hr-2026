'use client';

import { DataTable, type Column } from '@/components/ui/data-table';
import { useI18n } from '@/lib/i18n/client';
import { fmtDate } from '@/lib/i18n/format';

export interface AuditVM {
  id: string;
  at: string;
  user: string;
  email: string | null;
  action: string;
  entity: string | null;
  summary: string;
  ip: string | null;
}

export function AuditTable({ rows }: { rows: AuditVM[] }) {
  const { t, locale } = useI18n();
  const groups = [...new Set(rows.map((r) => r.action.split('.')[0]))];
  const columns: Column<AuditVM>[] = [
    { key: 'at', header: t.audit.when, cell: (r) => <span className="whitespace-nowrap text-sm">{fmtDate(r.at, locale, true)}</span>, sort: (r) => r.at, csv: (r) => r.at },
    { key: 'user', header: t.audit.user, cell: (r) => <span className="text-sm" title={r.email ?? ''}>{r.user}</span>, sort: (r) => r.user, csv: (r) => r.email ?? r.user },
    { key: 'action', header: t.audit.action, cell: (r) => <code className="ui-num text-xs">{r.action}</code>, sort: (r) => r.action, csv: (r) => r.action },
    { key: 'summary', header: t.audit.entity, cell: (r) => <span className="text-sm">{r.summary}</span>, csv: (r) => r.summary },
    { key: 'ip', header: t.audit.ip, cell: (r) => <span className="ui-num text-xs text-muted">{r.ip ?? '—'}</span>, csv: (r) => r.ip, hideSm: true },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      search={(r) => `${r.user} ${r.email ?? ''} ${r.action} ${r.summary}`}
      filters={groups.map((g) => ({ id: g, label: g, predicate: (r: AuditVM) => r.action.startsWith(`${g}.`) }))}
      exportName="audit-log"
      pageSize={40}
    />
  );
}
