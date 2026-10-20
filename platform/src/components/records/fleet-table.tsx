'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ExpiryBadge } from '@/components/ui/expiry';
import { Pill } from '@/components/ui/card';
import type { Readiness } from '@/lib/analytics/fleet';
import type { OpCardReason } from '@/lib/rules/classify';
import { useI18n } from '@/lib/i18n/client';
import { ArchiveButton, RecordEditor, RestoreButton } from './record-editor';

export interface VehicleVM {
  id: string;
  sequenceNumber: string;
  plateNumber: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  registrationType: string | null;
  branch: string | null;
  licenseExpiry: string | null;
  licenseExpiryHijri: string | null;
  inspectionExpiry: string | null;
  inspectionExpiryHijri: string | null;
  actualUserId: string | null;
  actualUserName: string | null;
  insuranceStatus: string | null;
  restrictionStatus: string | null;
  readiness: Readiness;
  opRequired: boolean;
  opReason: OpCardReason;
  opRequirement: 'auto' | 'required' | 'exempt';
  recordStatus: 'active' | 'missing' | 'archived';
}

export function FleetTable({ rows, today, canEdit }: { rows: VehicleVM[]; today: string; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const columns: Column<VehicleVM>[] = [
    {
      key: 'plate',
      header: t.fleet.plate,
      cell: (r) => (
        <div className="flex flex-col">
          <Link href={`/app/fleet/${r.sequenceNumber}`}>
            <b>{r.plateNumber ?? '—'}</b>
          </Link>
          <span className="ui-num text-xs text-muted">{r.sequenceNumber}</span>
        </div>
      ),
      sort: (r) => r.plateNumber,
      csv: (r) => r.plateNumber,
    },
    { key: 'seq', header: t.fleet.sequence, cell: () => null, csv: (r) => r.sequenceNumber, csvOnly: true },
    {
      key: 'vehicle',
      header: `${t.fleet.make} / ${t.fleet.model}`,
      cell: (r) => (
        <div className="flex flex-col">
          <span>{[r.make, r.model].filter(Boolean).join(' · ')}</span>
          <span className="text-xs text-muted">
            {r.registrationType ?? '—'} · <span className="ui-num">{r.year ?? '—'}</span>
          </span>
        </div>
      ),
      sort: (r) => `${r.make} ${r.model}`,
      csv: (r) => `${r.make ?? ''} ${r.model ?? ''}`,
    },
    {
      key: 'user',
      header: t.fleet.actualUser,
      cell: (r) => (r.actualUserId ? <Link href={`/app/people/${r.actualUserId}`}>{r.actualUserName ?? r.actualUserId}</Link> : <Pill tone="amber">{t.fleet.filterNoUser}</Pill>),
      sort: (r) => r.actualUserName,
      csv: (r) => r.actualUserName,
      hideSm: true,
    },
    { key: 'license', header: t.fleet.licenseExpiry, cell: (r) => <ExpiryBadge date={r.licenseExpiry} today={today} t={t} locale={locale} showDate />, sort: (r) => r.licenseExpiry, csv: (r) => r.licenseExpiry },
    { key: 'inspection', header: t.fleet.inspectionExpiry, cell: (r) => <ExpiryBadge date={r.inspectionExpiry} today={today} t={t} locale={locale} showDate />, sort: (r) => r.inspectionExpiry, csv: (r) => r.inspectionExpiry },
    {
      key: 'ready',
      header: t.fleet.readiness,
      cell: (r) => {
        const why = [
          !r.readiness.license && t.fleet.failLicense,
          !r.readiness.inspection && t.fleet.failInspection,
          !r.readiness.insurance && t.fleet.failInsurance,
          !r.readiness.unrestricted && t.fleet.failRestricted,
          !r.readiness.operatingCard && t.fleet.failOpCard,
        ].filter(Boolean) as string[];
        return r.readiness.ready ? (
          <Pill tone="green">{t.fleet.ready}</Pill>
        ) : (
          <Pill tone="red" title={why.join('، ')}>
            {why[0] ?? t.fleet.notReady}
            {why.length > 1 ? ` +${why.length - 1}` : ''}
          </Pill>
        );
      },
      sort: (r) => (r.readiness.ready ? 1 : 0),
      csv: (r) => (r.readiness.ready ? 'ready' : 'not ready'),
    },
    {
      key: 'op',
      header: t.fleet.opCard,
      cell: (r) => <Pill tone={r.opRequired ? (r.readiness.operatingCard ? 'green' : 'red') : 'gray'} title={t.fleet.opReasons[r.opReason]}>{r.opRequired ? t.fleet.opCardRequired : t.fleet.opCardNotRequired}</Pill>,
      sort: (r) => (r.opRequired ? 1 : 0),
      csv: (r) => r.opReason,
      hideSm: true,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        r.recordStatus === 'archived' ? (
          <RestoreButton kind="vehicles" id={r.id} canEdit={canEdit} />
        ) : (
          <div className="flex gap-2">
            <RecordEditor
              kind="vehicles"
              id={r.id}
              canEdit={canEdit}
              title={t.fleet.updateTitle.replace('{plate}', r.plateNumber ?? r.sequenceNumber)}
              fields={[
                { name: 'licenseExpiry', label: t.fleet.licenseExpiry, type: 'date', value: r.licenseExpiry },
                { name: 'inspectionExpiry', label: t.fleet.inspectionExpiry, type: 'date', value: r.inspectionExpiry },
                {
                  name: 'insuranceStatus',
                  label: t.fleet.insurance,
                  type: 'select',
                  value: r.insuranceStatus === 'غير ساري' ? 'غير ساري' : 'ساري المفعول',
                  options: [
                    { value: 'ساري المفعول', label: 'ساري المفعول' },
                    { value: 'غير ساري', label: 'غير ساري' },
                  ],
                },
                {
                  name: 'operatingCardRequirement',
                  label: t.fleet.opCardRequirement,
                  type: 'select',
                  value: r.opRequirement,
                  options: [
                    { value: 'auto', label: t.fleet.opCardAuto },
                    { value: 'required', label: t.fleet.opCardForce },
                    { value: 'exempt', label: t.fleet.opCardExempt },
                  ],
                },
              ]}
            />
            {r.recordStatus === 'missing' ? <ArchiveButton kind="vehicles" id={r.id} name={r.plateNumber ?? r.sequenceNumber} canEdit={canEdit} isVehicle /> : null}
          </div>
        ),
    },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      search={(r) => `${r.plateNumber ?? ''} ${r.sequenceNumber} ${r.make ?? ''} ${r.model ?? ''} ${r.actualUserName ?? ''} ${r.actualUserId ?? ''} ${r.branch ?? ''}`}
      filters={[
        { id: 'notready', label: t.fleet.filterNotReady, predicate: (r) => !r.readiness.ready },
        { id: 'nouser', label: t.fleet.filterNoUser, predicate: (r) => !r.actualUserId },
        { id: 'opmissing', label: t.fleet.filterOpMissing, predicate: (r) => r.opRequired && !r.readiness.operatingCard },
      ]}
      exportName="vehicles"
      rowHref={(r) => `/app/fleet/${r.sequenceNumber}`}
    />
  );
}
