import { and, desc, eq } from 'drizzle-orm';
import { CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { Card, Empty, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { fmtDate, getI18n } from '@/lib/i18n';
import { markAllRead, markRead } from './actions';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.notifications.title };
}

export default async function NotificationsPage() {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, s.user.id), eq(notifications.tenantId, s.tenant.id)))
    .orderBy(desc(notifications.createdAt))
    .limit(200);
  return (
    <>
      <PageHead
        title={t.notifications.title}
        actions={
          <form action={markAllRead}>
            <button type="submit" className="ui-btn ui-btn--ghost">
              <CheckCheck size={18} />
              {t.notifications.markAllRead}
            </button>
          </form>
        }
      />
      <Card flat>
        {rows.length ? (
          <div>
            {rows.map((n) => (
              <div key={n.id} className="alert-row" style={n.readAt ? undefined : { background: 'var(--surface-hover)' }}>
                <span className="sev-dot" data-sev={n.severity} style={{ marginTop: 8 }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{locale === 'ar' ? n.titleAr : n.titleEn}</b>
                    {n.readAt ? null : <span className="ui-pill ui-pill--amber">{t.notifications.unread}</span>}
                  </div>
                  <p className="truncate-2 text-sm text-muted">{locale === 'ar' ? n.bodyAr : n.bodyEn}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span>{fmtDate(n.createdAt, locale, true)}</span>
                    {n.link ? <Link href={n.link}>{t.common.open}</Link> : null}
                    {n.readAt ? null : (
                      <form action={markRead.bind(null, n.id)}>
                        <button type="submit" className="text-xs" style={{ background: 'none', border: 0, color: 'var(--link)', cursor: 'pointer', padding: 0 }}>
                          {t.notifications.markRead}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>{t.notifications.empty}</Empty>
        )}
      </Card>
    </>
  );
}
