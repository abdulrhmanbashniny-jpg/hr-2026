'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Money, Pill } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n/client';
import { fmtNumber } from '@/lib/i18n/format';
import { ArchiveButton, RecordEditor, RestoreButton } from './record-editor';
import { expiryText } from '@/components/ui/expiry';

export interface GosiVM {
  id: string;
  nationalId: string;
  name: string;
  nationality: string | null;
  isSaudi: boolean;
  occupation: string | null;
  basicWage: number;
  housingAllowance: number;
  totalWage: number;
  contributoryWage: number;
  joinDate: string | null;
  newSystemEligible: boolean;
  employerShare: number;
  employeeShare: number;
  eosYears: number;
  eosAmount: number;
  probationEnd: string | null;
  probationLeft: number | null;
  probationReviewed: boolean;
  probationDays: number | null;
  lowWage: boolean;
  recordStatus: 'active' | 'missing' | 'archived';
}

export function GosiTable({ rows, canEdit }: { rows: GosiVM[]; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const money = (n: number) => <span className="ui-num">{fmtNumber(n)}</span>;
  const columns: Column<GosiVM>[] = [
    { key: 'id', header: t.gosi.nationalId, cell: (r) => <Link href={`/app/people/${r.nationalId}`} className="ui-num">{r.nationalId}</Link>, sort: (r) => r.nationalId, csv: (r) => r.nationalId },
    {
      key: 'name',
      header: t.gosi.name,
      cell: (r) => (
        <div className="flex flex-col gap-1">
          <b>{r.name}</b>
          <span className="flex flex-wrap gap-1">
            <Pill tone={r.isSaudi ? 'green' : 'gray'}>{r.isSaudi ? t.gosi.saudi : (r.nationality ?? t.gosi.nonSaudi)}</Pill>
            {r.newSystemEligible ? <Pill tone="blue">{t.gosi.newSystem}</Pill> : null}
            {r.lowWage ? <Pill tone="amber">{t.gosi.filterLowWage}</Pill> : null}
          </span>
        </div>
      ),
      sort: (r) => r.name,
      csv: (r) => r.name,
    },
    { key: 'occupation', header: t.gosi.occupation, cell: (r) => r.occupation ?? '—', sort: (r) => r.occupation, csv: (r) => r.occupation, hideSm: true },
    { key: 'total', header: t.gosi.totalWage, cell: (r) => money(r.totalWage), sort: (r) => r.totalWage, csv: (r) => r.totalWage },
    { key: 'contrib', header: t.gosi.contributoryWage, cell: (r) => money(r.contributoryWage), sort: (r) => r.contributoryWage, csv: (r) => r.contributoryWage },
    {
      key: 'share',
      header: t.gosi.contribution,
      cell: (r) => (
        <span className="ui-num text-sm" title={`${t.gosi.employerShare}: ${r.employerShare} · ${t.gosi.employeeShare}: ${r.employeeShare}`}>
          {fmtNumber(r.employerShare + r.employeeShare, 2)}
        </span>
      ),
      sort: (r) => r.employerShare + r.employeeShare,
      csv: (r) => r.employerShare + r.employeeShare,
      hideSm: true,
    },
    { key: 'join', header: t.gosi.joinDate, cell: (r) => <span className="ui-num">{r.joinDate ?? '—'}</span>, sort: (r) => r.joinDate, csv: (r) => r.joinDate, hideSm: true },
    {
      key: 'probation',
      header: t.gosi.probation,
      cell: (r) =>
        r.probationLeft === null ? (
          <span className="text-muted">—</span>
        ) : r.probationReviewed ? (
          <Pill tone="green">{t.gosi.probationReviewed}</Pill>
        ) : (
          <span className="ui-expiry" data-bucket={r.probationLeft <= 15 ? 'd30' : 'd90'}>
            <span className="ui-expiry__dot" />
            {expiryText(r.probationLeft, t, locale)}
          </span>
        ),
      sort: (r) => r.probationLeft,
      csv: (r) => r.probationEnd,
    },
    {
      key: 'eos',
      header: t.gosi.eos,
      cell: (r) => (
        <span className="text-sm" title={`${t.gosi.serviceYears}: ${r.eosYears}`}>
          <Money value={r.eosAmount} unit={t.common.sar} />
        </span>
      ),
      sort: (r) => r.eosAmount,
      csv: (r) => r.eosAmount,
      hideSm: true,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        r.recordStatus === 'archived' ? (
          <RestoreButton kind="gosi" id={r.id} canEdit={canEdit} />
        ) : (
          <div className="flex gap-2">
            <RecordEditor
              kind="gosi"
              id={r.id}
              canEdit={canEdit}
              title={t.gosi.updateTitle.replace('{name}', r.name)}
              fields={[
                {
                  name: 'probationDays',
                  label: t.gosi.probationDays,
                  type: 'select',
                  value: r.probationDays ? String(r.probationDays) : '',
                  options: [
                    { value: '', label: `${t.settings.probationDays} (${locale === 'ar' ? 'افتراضي' : 'default'})` },
                    { value: '90', label: '90' },
                    { value: '180', label: '180' },
                  ],
                },
                { name: 'probationReviewedAt', label: t.gosi.markReviewed, type: 'bool', value: r.probationReviewed },
              ]}
            />
            {r.recordStatus === 'missing' ? <ArchiveButton kind="gosi" id={r.id} name={r.name} canEdit={canEdit} /> : null}
          </div>
        ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      search={(r) => `${r.name} ${r.nationalId} ${r.nationality ?? ''} ${r.occupation ?? ''}`}
      filters={[
        { id: 'saudi', label: t.gosi.filterSaudi, predicate: (r) => r.isSaudi },
        { id: 'low', label: t.gosi.filterLowWage, predicate: (r) => r.lowWage },
        { id: 'probation', label: t.gosi.filterProbation, predicate: (r) => r.probationLeft !== null && !r.probationReviewed },
      ]}
      exportName="gosi"
      rowHref={(r) => `/app/people/${r.nationalId}`}
    />
  );
}
