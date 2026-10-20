'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ExpiryBadge } from '@/components/ui/expiry';
import { Pill } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n/client';
import { isActiveCardStatus } from '@/lib/rules/classify';
import { RecordEditor, RestoreButton, RowActions } from './record-editor';

export interface CardVM {
  id: string;
  cardNumber: string;
  holderKey: string | null;
  holderLabel: string | null;
  holderHref: string | null;
  activity: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string | null;
  extra?: string | null;
  recordStatus: 'active' | 'missing' | 'archived';
}

export function CardsTable({ kind, rows, today, canEdit }: { kind: 'operating_cards' | 'driver_cards'; rows: CardVM[]; today: string; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const isOp = kind === 'operating_cards';
  const L = isOp ? t.opCards : t.driverCards;
  const statusOptions = isOp ? ['نشط', 'منتهية', 'ملغاة', 'موقوفة'] : ['نشط', 'منتهية', 'ملغاة', 'قيد المعالجة'];
  const columns: Column<CardVM>[] = [
    { key: 'card', header: L.cardNumber, cell: (r) => <span className="ui-num font-semibold">{r.cardNumber}</span>, sort: (r) => r.cardNumber, csv: (r) => r.cardNumber },
    {
      key: 'holder',
      header: isOp ? t.opCards.vehicle : t.driverCards.name,
      cell: (r) => (
        <div className="flex flex-col">
          {r.holderHref && r.holderLabel ? <Link href={r.holderHref}>{r.holderLabel}</Link> : <Pill tone="amber">{t.opCards.orphan}</Pill>}
          <span className="ui-num text-xs text-muted">{r.holderKey}</span>
        </div>
      ),
      sort: (r) => r.holderLabel,
      csv: (r) => r.holderKey,
    },
    { key: 'activity', header: L.activity, cell: (r) => r.activity ?? '—', sort: (r) => r.activity, csv: (r) => r.activity, hideSm: true },
    { key: 'issue', header: L.issueDate, cell: (r) => <span className="ui-num">{r.issueDate ?? '—'}</span>, sort: (r) => r.issueDate, csv: (r) => r.issueDate, hideSm: true },
    { key: 'expiry', header: L.expiryDate, cell: (r) => <ExpiryBadge date={r.expiryDate} today={today} t={t} locale={locale} showDate />, sort: (r) => r.expiryDate, csv: (r) => r.expiryDate },
    { key: 'status', header: isOp ? t.opCards.status : t.driverCards.requestStatus, cell: (r) => <Pill tone={isActiveCardStatus(r.status) ? 'green' : 'red'}>{r.status ?? '—'}</Pill>, sort: (r) => r.status, csv: (r) => r.status },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        r.recordStatus === 'archived' ? (
          <div className="flex gap-2">
            <RestoreButton kind={kind} id={r.id} canEdit={canEdit} />
            <RowActions kind={kind} id={r.id} name={r.cardNumber} canEdit={canEdit} archived />
          </div>
        ) : (
          <div className="flex gap-2">
            <RecordEditor
              kind={kind}
              id={r.id}
              canEdit={canEdit}
              title={isOp ? t.opCards.updateTitle.replace('{card}', r.cardNumber) : t.driverCards.updateTitle.replace('{name}', r.holderLabel ?? r.cardNumber)}
              fields={[
                { name: 'expiryDate', label: L.expiryDate, type: 'date', value: r.expiryDate },
                {
                  name: isOp ? 'cardStatus' : 'requestStatus',
                  label: isOp ? t.opCards.status : t.driverCards.requestStatus,
                  type: 'select',
                  value: r.status && statusOptions.includes(r.status) ? r.status : statusOptions[0],
                  options: statusOptions.map((o) => ({ value: o, label: o })),
                },
              ]}
            />
            <RowActions kind={kind} id={r.id} name={r.cardNumber} canEdit={canEdit} />
          </div>
        ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      search={(r) => `${r.cardNumber} ${r.holderKey ?? ''} ${r.holderLabel ?? ''} ${r.activity ?? ''}`}
      filters={[
        { id: 'inactive', label: locale === 'ar' ? 'غير نشطة' : 'Inactive', predicate: (r) => !isActiveCardStatus(r.status) },
        { id: 'soon', label: t.expiry.d30, predicate: (r) => !!r.expiryDate && r.expiryDate <= new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10) },
      ]}
      exportName={kind}
    />
  );
}
