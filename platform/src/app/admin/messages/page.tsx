import { asc, desc, eq } from 'drizzle-orm';
import { MessagesCenter, type MessageVM } from '@/components/admin/messages-center';
import { PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { announcements, plans, subscriptions, tenants, users } from '@/db/schema';
import { audienceMatches } from '@/lib/admin/announcements';
import { getI18n } from '@/lib/i18n';
import { emailEnabled } from '@/lib/notifications/email';
import { requireSuperAdmin } from '@/lib/auth/guards';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.console.messages.title };
}

export default async function AdminMessages() {
  await requireSuperAdmin('messages:send');
  const { t, locale } = await getI18n();
  const m = t.console.messages;
  const [planRows, tenantRows, rows] = await Promise.all([
    db.select().from(plans).orderBy(asc(plans.sortOrder)),
    db.select({ id: tenants.id, name: tenants.name, status: subscriptions.status, planId: subscriptions.planId }).from(tenants).leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id)).orderBy(asc(tenants.name)),
    db.select({ a: announcements, author: users.name }).from(announcements).leftJoin(users, eq(users.id, announcements.createdBy)).orderBy(desc(announcements.createdAt)).limit(60),
  ]);
  const count = (kind: 'all' | 'trialing' | 'active' | 'expired') => tenantRows.filter((x) => audienceMatches({ kind }, x)).length;
  const tenantName = new Map(tenantRows.map((x) => [x.id, x.name]));
  const planName = new Map(planRows.map((p) => [p.id, locale === 'ar' ? p.nameAr : p.nameEn]));
  const now = new Date();
  const history: MessageVM[] = rows.map(({ a, author }) => {
    const aud = a.audience;
    const label =
      aud.kind === 'tenants'
        ? (aud.tenantIds ?? []).map((id) => tenantName.get(id) ?? '—').slice(0, 3).join('، ') + ((aud.tenantIds?.length ?? 0) > 3 ? '…' : '')
        : aud.kind === 'plan'
          ? `${m.audiences.plan}: ${(aud.planIds ?? []).map((id) => planName.get(id) ?? '—').join('، ')}`
          : m.audiences[aud.kind];
    const live = !a.archivedAt && a.channels.includes('banner') && (!a.endsAt || a.endsAt > now);
    return {
      id: a.id,
      title: a.title,
      body: a.body,
      level: a.level,
      audience: label,
      channels: a.channels,
      tenantCount: a.tenantCount,
      userCount: a.userCount,
      emailSent: a.emailSent,
      emailFailed: a.emailFailed,
      createdAt: a.createdAt.toISOString(),
      author,
      state: live ? 'live' : a.channels.includes('banner') ? 'ended' : 'sent',
    };
  });
  return (
    <>
      <PageHead title={m.title} sub={m.sub} />
      <MessagesCenter
        plans={planRows.map((p) => ({ id: p.id, name: locale === 'ar' ? p.nameAr : p.nameEn }))}
        tenants={tenantRows.map((x) => ({ id: x.id, name: x.name }))}
        counts={{ all: count('all'), trialing: count('trialing'), active: count('active'), expired: count('expired') }}
        emailEnabled={await emailEnabled(null)}
        history={history}
      />
    </>
  );
}
