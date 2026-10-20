import { count, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Mail, Send, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { InboxList, type ContactStatus } from '@/components/admin/inbox';
import { PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { contactMessages, tenants, users } from '@/db/schema';
import { staffCan } from '@/lib/admin/staff';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { platformAlertTarget } from '@/lib/contact';
import { getI18n } from '@/lib/i18n';
import { emailEnabled } from '@/lib/notifications/email';
import { normalizeSaudiPhone } from '@/lib/notifications/wa-link';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.inbox.title };
}

const FILTERS = ['new', 'in_progress', 'closed', 'all'] as const;

export default async function AdminInbox(props: PageProps<'/admin/inbox'>) {
  const s = await requireSuperAdmin('inbox:view');
  const { t } = await getI18n();
  const c = t.console.inbox;
  const sp = await props.searchParams;
  const filter = (FILTERS as readonly string[]).includes(String(sp.s)) ? (sp.s as (typeof FILTERS)[number]) : 'all';
  const handler = alias(users, 'handler');
  const [rows, counts, tg, mail] = await Promise.all([
    db
      .select({ m: contactMessages, tenantName: tenants.name, email: users.email, handler: handler.name })
      .from(contactMessages)
      .leftJoin(tenants, eq(tenants.id, contactMessages.tenantId))
      .leftJoin(users, eq(users.id, contactMessages.userId))
      .leftJoin(handler, eq(handler.id, contactMessages.handledBy))
      .where(filter === 'all' ? undefined : eq(contactMessages.status, filter))
      .orderBy(desc(contactMessages.createdAt))
      .limit(300),
    db.select({ status: contactMessages.status, n: count() }).from(contactMessages).groupBy(contactMessages.status),
    platformAlertTarget(),
    emailEnabled(null),
  ]);
  const n = (k: ContactStatus) => counts.find((x) => x.status === k)?.n ?? 0;
  const total = counts.reduce((a, x) => a + x.n, 0);
  return (
    <>
      <PageHead
        eyebrow={t.console.nav.groupCustomers}
        title={c.title}
        sub={c.sub}
        actions={
          staffCan(s.user.staffRole, 'system:manage') ? (
            <Link href="/admin/system" className="ui-btn ui-btn--outline">
              <Settings2 size={17} />
              {c.setup}
            </Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="ui-seg" role="group" aria-label={c.title}>
          {FILTERS.map((k) => (
            <Link key={k} href={`/admin/inbox?s=${k}`} aria-pressed={k === filter} className="ui-seg__link">
              {k === 'all' ? c.all : c.status[k]}
              <span className="ui-tab__count ms-1.5">{k === 'all' ? total : n(k)}</span>
            </Link>
          ))}
        </div>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {c.channels}:
          <span className={`ui-pill ${tg ? 'ui-pill--green' : 'ui-pill--gray'}`}>
            <Send size={12} /> {c.channelTelegram} · {tg ? c.channelOn : c.channelOff}
          </span>
          <span className={`ui-pill ${mail ? 'ui-pill--green' : 'ui-pill--gray'}`}>
            <Mail size={12} /> {c.channelEmail} · {mail ? c.channelOn : c.channelOff}
          </span>
        </span>
      </div>
      <InboxList
        rows={rows.map(({ m, tenantName, email, handler: handledBy }) => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          wa: normalizeSaudiPhone(m.phone),
          category: m.category,
          message: m.message,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
          tenant: m.tenantId && tenantName ? { id: m.tenantId, name: tenantName } : null,
          account: m.userId && email ? { id: m.userId, email } : null,
          handledBy: handledBy ?? null,
        }))}
      />
    </>
  );
}
