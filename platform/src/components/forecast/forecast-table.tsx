'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { expiryText } from '@/components/ui/expiry';
import type { FeeLine } from '@/lib/analytics/forecast';
import { bucketForDays } from '@/lib/dates';
import { useI18n } from '@/lib/i18n/client';
import { Money } from '@/components/ui/card';

export function ForecastTable({ rows }: { rows: FeeLine[] }) {
  const { t, locale } = useI18n();
  const columns: Column<FeeLine>[] = [
    { key: 'cat', header: t.forecast.item, cell: (r) => <span className="text-sm">{t.forecast.categories[r.category]}</span>, sort: (r) => r.category, csv: (r) => r.category },
    { key: 'label', header: t.common.name, cell: (r) => <Link href={r.link}>{r.label}</Link>, sort: (r) => r.label, csv: (r) => r.label },
    {
      key: 'due',
      header: t.alerts.due,
      cell: (r) => (
        <span className="ui-expiry" data-bucket={bucketForDays(r.daysLeft)} title={r.dueDate ?? ''}>
          <span className="ui-expiry__dot" />
          {expiryText(r.daysLeft, t, locale)}
        </span>
      ),
      sort: (r) => r.daysLeft,
      csv: (r) => r.dueDate,
    },
    { key: 'amount', header: t.forecast.amount, cell: (r) => <Money value={r.amount} unit={t.common.sar} />, sort: (r) => r.amount, csv: (r) => r.amount },
  ];
  return <DataTable rows={rows} columns={columns} rowKey={(r) => `${r.category}:${r.key}`} search={(r) => `${r.label} ${t.forecast.categories[r.category]}`} exportName="fees-forecast" pageSize={20} />;
}
