import Link from 'next/link';
import type { complianceAlerts } from '@/db/schema';
import type { Dictionary } from '@/lib/i18n/ar';
import type { Locale } from '@/lib/i18n/format';

type Alert = typeof complianceAlerts.$inferSelect;

export function AlertList({ alerts, t, locale, empty }: { alerts: Alert[]; t: Dictionary; locale: Locale; empty?: string }) {
  if (!alerts.length) return <div className="ui-empty">{empty ?? t.alerts.empty}</div>;
  return (
    <div>
      {alerts.map((a) => (
        <div key={a.id} className="alert-row">
          <span className="sev-dot" data-sev={a.severity} style={{ marginTop: 8 }} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <b className="text-[15px]">{locale === 'ar' ? a.titleAr : a.titleEn}</b>
              <span className="ui-pill ui-pill--gray">{t.severity[a.severity]}</span>
              <span className="text-xs text-muted">{t.modules[a.module]}</span>
            </div>
            <div className="text-sm">
              {a.link ? <Link href={a.link}>{a.entityLabel}</Link> : a.entityLabel}
            </div>
            <p className="truncate-2 text-sm text-muted">{locale === 'ar' ? a.detailAr : a.detailEn}</p>
          </div>
          {a.dueDate ? <span className="ui-num shrink-0 text-xs text-muted">{a.dueDate}</span> : null}
        </div>
      ))}
    </div>
  );
}

const RANK = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
export function sortAlerts<T extends Pick<Alert, 'severity' | 'dueDate'>>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}
