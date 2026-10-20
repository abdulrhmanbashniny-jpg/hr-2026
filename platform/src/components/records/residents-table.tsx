'use client';

import Link from 'next/link';
import { ExpiryBadge } from '@/components/ui/expiry';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pill } from '@/components/ui/card';
import { daysUntil } from '@/lib/dates';
import { useI18n } from '@/lib/i18n/client';
import { RecordEditor, RestoreButton, RowActions } from './record-editor';

export interface ResidentVM {
  id: string;
  iqamaNumber: string;
  name: string;
  nationality: string | null;
  occupation: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  iqamaExpiry: string | null;
  age: number | null;
  outsideKingdom: boolean;
  conflict: boolean;
  recordStatus: 'active' | 'missing' | 'archived';
  archiveReason: string | null;
}

export function ResidentsTable({ rows, today, canEdit }: { rows: ResidentVM[]; today: string; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const columns: Column<ResidentVM>[] = [
    { key: 'iqama', header: t.residents.iqamaNumber, cell: (r) => <Link href={`/app/people/${r.iqamaNumber}`} className="ui-num">{r.iqamaNumber}</Link>, sort: (r) => r.iqamaNumber, csv: (r) => r.iqamaNumber },
    {
      key: 'name',
      header: t.residents.name,
      cell: (r) => (
        <div className="flex flex-col gap-1">
          <b>{r.name}</b>
          <span className="flex flex-wrap gap-1">
            {r.outsideKingdom ? <Pill tone="blue">{t.residents.outside}</Pill> : null}
            {r.conflict ? <Pill tone="red">{t.residents.conflictBadge}</Pill> : null}
            {r.recordStatus === 'archived' && r.archiveReason ? <Pill tone="gray">{t.residents.reasons[r.archiveReason as 'other'] ?? r.archiveReason}</Pill> : null}
          </span>
        </div>
      ),
      sort: (r) => r.name,
      csv: (r) => r.name,
    },
    { key: 'nationality', header: t.residents.nationality, cell: (r) => r.nationality ?? '—', sort: (r) => r.nationality, csv: (r) => r.nationality, hideSm: true },
    { key: 'occupation', header: t.residents.occupation, cell: (r) => r.occupation ?? '—', sort: (r) => r.occupation, csv: (r) => r.occupation, hideSm: true },
    { key: 'iqamaExpiry', header: t.residents.iqamaExpiry, cell: (r) => <ExpiryBadge date={r.iqamaExpiry} today={today} t={t} locale={locale} showDate />, sort: (r) => r.iqamaExpiry, csv: (r) => r.iqamaExpiry },
    { key: 'passportExpiry', header: t.residents.passportExpiry, cell: (r) => <ExpiryBadge date={r.passportExpiry} today={today} t={t} locale={locale} showDate />, sort: (r) => r.passportExpiry, csv: (r) => r.passportExpiry },
    { key: 'age', header: t.residents.age, cell: (r) => <span className="ui-num">{r.age ?? '—'}</span>, sort: (r) => r.age, csv: (r) => r.age, hideSm: true },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        r.recordStatus === 'archived' ? (
          <div className="flex gap-2">
            <RestoreButton kind="residents" id={r.id} canEdit={canEdit} />
            <RowActions kind="residents" id={r.id} name={r.name} canEdit={canEdit} archived />
          </div>
        ) : (
          <div className="flex gap-2">
            <RecordEditor
              kind="residents"
              id={r.id}
              canEdit={canEdit}
              title={t.residents.updateTitle.replace('{name}', r.name)}
              hint={t.residents.updateHint}
              fields={[
                { name: 'iqamaExpiry', label: t.residents.iqamaExpiry, type: 'date', value: r.iqamaExpiry },
                { name: 'passportExpiry', label: t.residents.passportExpiry, type: 'date', value: r.passportExpiry },
                { name: 'outsideKingdom', label: t.residents.outside, type: 'bool', value: r.outsideKingdom },
              ]}
            />
            <RowActions kind="residents" id={r.id} name={r.name} canEdit={canEdit} />
          </div>
        ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      search={(r) => `${r.name} ${r.iqamaNumber} ${r.passportNumber ?? ''} ${r.nationality ?? ''} ${r.occupation ?? ''}`}
      filters={[
        { id: 'outside', label: t.residents.filterOutside, predicate: (r) => r.outsideKingdom },
        { id: 'conflict', label: t.residents.filterConflict, predicate: (r) => r.conflict },
        { id: 'senior', label: t.residents.filterSenior, predicate: (r) => (r.age ?? 0) >= 60 },
        { id: 'soon', label: t.expiry.d30, predicate: (r) => { const d = daysUntil(r.iqamaExpiry, today); return d !== null && d <= 30; } },
      ]}
      exportName="residents"
      rowHref={(r) => `/app/people/${r.iqamaNumber}`}
    />
  );
}
