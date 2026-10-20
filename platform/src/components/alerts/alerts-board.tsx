'use client';

import { Check, Clock, MessageCircle, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { alertAction } from '@/app/app/alerts/actions';
import { DataTable, type Column } from '@/components/ui/data-table';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import { f, fmtDate } from '@/lib/i18n/format';
import { waDeepLink } from '@/lib/notifications/wa-link';

export interface AlertVM {
  id: string;
  ruleCode: string;
  ruleLabel: string;
  module: 'residents' | 'gosi' | 'fleet' | 'operating_cards' | 'driver_cards' | 'documents' | 'cross';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  detailAr: string;
  entityLabel: string;
  link: string | null;
  dueDate: string | null;
  firstSeen: string;
  snoozedUntil: string | null;
  acknowledgedBy: string | null;
  resolvedReason: string | null;
}

const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;

export function AlertsBoard({ rows, status, canManage, contacts, initialSeverity }: { rows: AlertVM[]; status: string; canManage: boolean; contacts: { id: string; name: string; phone: string | null; modules: string[] }[]; initialSeverity: string | null }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const run = (ids: string[], op: 'acknowledge' | 'snooze3' | 'snooze7' | 'reopen') =>
    start(async () => {
      const r = await alertAction(ids, op);
      toast(r.ok ? (r.message ?? t.settings.saved) : r.error, r.ok ? 'ok' : 'err');
      if (r.ok) setSelected(new Set());
    });

  const waFor = (a: AlertVM) => {
    const c = contacts.find((x) => x.phone && (x.modules.length === 0 || x.modules.includes(a.module)));
    return waDeepLink(c?.phone, `متابعة — ${a.title}\n${a.entityLabel}\n${a.detailAr}`);
  };

  const actions = (a: AlertVM) => (
    <div className="flex flex-wrap gap-1.5">
      {status !== 'resolved' && status !== 'acknowledged' ? (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run([a.id], 'acknowledge')}>
          <Check size={16} />
          {t.alerts.acknowledge}
        </button>
      ) : null}
      {status === 'open' ? (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run([a.id], 'snooze3')} title={t.alerts.snooze3}>
          <Clock size={16} />
          {t.alerts.snooze}
        </button>
      ) : null}
      {status === 'acknowledged' || status === 'snoozed' ? (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run([a.id], 'reopen')}>
          <Undo2 size={16} />
          {t.alerts.reopen}
        </button>
      ) : null}
      <a className="ui-btn ui-btn--whatsapp ui-btn--sm" href={waFor(a)} target="_blank" rel="noopener noreferrer" aria-label={t.alerts.sendWhatsApp}>
        <MessageCircle size={16} />
      </a>
    </div>
  );

  const columns: Column<AlertVM>[] = [
    {
      key: 'sev',
      header: t.common.status,
      cell: (a) => (
        <span className="flex items-center gap-2 whitespace-nowrap">
          <span className="sev-dot" data-sev={a.severity} />
          {t.severity[a.severity]}
        </span>
      ),
      sort: (a) => SEV_RANK[a.severity],
      csv: (a) => a.severity,
    },
    {
      key: 'alert',
      header: t.alerts.rule,
      cell: (a) => (
        <div className="flex max-w-[560px] flex-col gap-0.5">
          <b>{a.title}</b>
          <span className="text-sm">{a.link ? <Link href={a.link}>{a.entityLabel}</Link> : a.entityLabel}</span>
          <span className="truncate-2 text-sm text-muted">{a.detail}</span>
          {a.snoozedUntil ? <span className="text-xs text-muted">{f(t.alerts.snoozedUntil, { date: fmtDate(a.snoozedUntil, locale, true) })}</span> : null}
          {a.acknowledgedBy ? <span className="text-xs text-muted">{f(t.alerts.acknowledgedBy, { name: a.acknowledgedBy })}</span> : null}
          {a.resolvedReason ? <span className="text-xs text-muted">{t.alerts.resolvedReason[a.resolvedReason as 'manual'] ?? a.resolvedReason}</span> : null}
        </div>
      ),
      sort: (a) => a.title,
      csv: (a) => `${a.title} — ${a.entityLabel}`,
    },
    { key: 'module', header: t.alerts.module, cell: (a) => <span className="whitespace-nowrap text-sm">{t.modules[a.module]}</span>, sort: (a) => a.module, csv: (a) => a.module, hideSm: true },
    { key: 'due', header: t.alerts.due, cell: (a) => <span className="ui-num whitespace-nowrap text-sm">{a.dueDate ?? '—'}</span>, sort: (a) => a.dueDate, csv: (a) => a.dueDate },
    { key: 'detail', header: '', cell: () => null, csv: (a) => a.detail, csvHeader: 'detail', csvOnly: true },
    ...(canManage ? [{ key: 'actions', header: '', cell: actions }] : []),
  ];

  const modules = [...new Set(rows.map((r) => r.module))];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(a) => a.id}
      search={(a) => `${a.title} ${a.entityLabel} ${a.detail} ${a.ruleLabel}`}
      filters={[
        { id: 'critical', label: t.severity.critical, predicate: (a) => a.severity === 'critical' },
        { id: 'high', label: t.severity.high, predicate: (a) => a.severity === 'high' },
        ...modules.map((m) => ({ id: `m:${m}`, label: t.modules[m], predicate: (a: AlertVM) => a.module === m })),
      ]}
      initialFilters={initialSeverity ? [initialSeverity] : []}
      selectable={canManage}
      selected={selected}
      onSelectedChange={setSelected}
      exportName="alerts"
      pageSize={30}
      toolbar={
        canManage && selected.size ? (
          <>
            <span className="text-sm text-muted">{f(t.common.selected, { n: selected.size })}</span>
            {status !== 'acknowledged' && status !== 'resolved' ? (
              <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={pending} onClick={() => run([...selected], 'acknowledge')}>
                <Check size={16} />
                {t.alerts.acknowledge}
              </button>
            ) : null}
            {status === 'open' ? (
              <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run([...selected], 'snooze7')}>
                <Clock size={16} />
                {t.alerts.snooze} {t.alerts.snooze7}
              </button>
            ) : null}
          </>
        ) : null
      }
      empty={t.alerts.empty}
    />
  );
}
