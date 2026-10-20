import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { announcementDismissals, announcements, memberships, notifications, subscriptions, tenants, users, type AnnouncementAudience } from '@/db/schema';
import { emailEnabled, emailLayout, sendEmail } from '@/lib/notifications/email';
import { escapeHtml } from '@/lib/notifications/telegram';

type Level = 'info' | 'success' | 'warning' | 'critical';
type Channel = 'banner' | 'in_app' | 'email';
interface TenantFacts {
  id: string;
  status: string | null;
  planId: string | null;
}

/** Whether a company belongs to an announcement's audience. Expired includes canceled. */
export function audienceMatches(a: AnnouncementAudience, t: TenantFacts): boolean {
  switch (a.kind) {
    case 'all':
      return true;
    case 'trialing':
      return t.status === 'trialing';
    case 'active':
      return t.status === 'active' || t.status === 'past_due';
    case 'expired':
      return t.status === 'expired' || t.status === 'canceled';
    case 'plan':
      return !!t.planId && (a.planIds ?? []).includes(t.planId);
    case 'tenants':
      return (a.tenantIds ?? []).includes(t.id);
  }
}

async function tenantFacts(): Promise<TenantFacts[]> {
  const rows = await db
    .select({ id: tenants.id, status: subscriptions.status, planId: subscriptions.planId })
    .from(tenants)
    .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id));
  return rows;
}

const SEVERITY: Record<Level, 'info' | 'low' | 'medium' | 'high'> = { info: 'info', success: 'low', warning: 'medium', critical: 'high' };

/**
 * Creates an announcement and delivers it: in-app notifications to every member of the matching
 * companies and, when platform SMTP is configured, an e-mail to each. The banner is read live by the
 * workspace layout, so it needs no delivery step.
 */
export async function publishAnnouncement(input: {
  title: string;
  body: string;
  level: Level;
  audience: AnnouncementAudience;
  channels: Channel[];
  link: string | null;
  endsAt: Date | null;
  createdBy: string;
}): Promise<{ id: string; tenantCount: number; userCount: number; emailSent: number; emailFailed: number } | null> {
  const targets = (await tenantFacts()).filter((t) => audienceMatches(input.audience, t)).map((t) => t.id);
  if (!targets.length) return null;
  const members = await db
    .select({ tenantId: memberships.tenantId, userId: users.id, email: users.email, name: users.name, disabledAt: users.disabledAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(inArray(memberships.tenantId, targets));
  const live = members.filter((m) => !m.disabledAt);

  const [row] = await db
    .insert(announcements)
    .values({ title: input.title, body: input.body, level: input.level, audience: input.audience, channels: input.channels, link: input.link, endsAt: input.endsAt, createdBy: input.createdBy, tenantCount: targets.length, userCount: new Set(live.map((m) => m.userId)).size })
    .returning({ id: announcements.id });

  if (input.channels.includes('in_app') && live.length) {
    await db.insert(notifications).values(
      live.map((m) => ({
        tenantId: m.tenantId,
        userId: m.userId,
        titleAr: input.title,
        titleEn: input.title,
        bodyAr: input.body,
        bodyEn: input.body,
        link: input.link,
        severity: SEVERITY[input.level],
      })),
    );
  }

  let emailSent = 0;
  let emailFailed = 0;
  if (input.channels.includes('email') && (await emailEnabled(null))) {
    const seen = new Set<string>();
    for (const m of live) {
      if (seen.has(m.email)) continue;
      seen.add(m.email);
      const html = emailLayout(
        input.title,
        `<p>مرحباً ${escapeHtml(m.name)}،</p>${input.body
          .split(/\n{2,}/)
          .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
          .join('')}${input.link ? `<p><a href="${escapeHtml(input.link)}" style="color:#007aff">${escapeHtml(input.link)}</a></p>` : ''}`,
        'فريق منصة متابعة',
      );
      try {
        await sendEmail(null, { to: m.email, subject: `متابعة · ${input.title}`, html, text: `${input.title}\n\n${input.body}${input.link ? `\n\n${input.link}` : ''}` });
        emailSent++;
      } catch (err) {
        console.error('announcement mail failed', err);
        emailFailed++;
      }
    }
    await db.update(announcements).set({ emailSent, emailFailed }).where(eq(announcements.id, row.id));
  }
  return { id: row.id, tenantCount: targets.length, userCount: new Set(live.map((m) => m.userId)).size, emailSent, emailFailed };
}

export interface BannerVM {
  id: string;
  title: string;
  body: string;
  level: Level;
  link: string | null;
}

/** Live banners for one company and user: not archived, started, not ended, not dismissed. */
export async function bannersFor(tenant: TenantFacts, userId: string): Promise<BannerVM[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(announcements)
    .where(isNull(announcements.archivedAt))
    .orderBy(desc(announcements.createdAt))
    .limit(30);
  const live = rows.filter((a) => a.channels.includes('banner') && a.startsAt <= now && (!a.endsAt || a.endsAt > now) && audienceMatches(a.audience, tenant));
  if (!live.length) return [];
  const dismissed = await db
    .select({ id: announcementDismissals.announcementId })
    .from(announcementDismissals)
    .where(and(eq(announcementDismissals.userId, userId), inArray(announcementDismissals.announcementId, live.map((a) => a.id))));
  const hidden = new Set(dismissed.map((d) => d.id));
  return live.filter((a) => !hidden.has(a.id)).slice(0, 3).map((a) => ({ id: a.id, title: a.title, body: a.body, level: a.level, link: a.link }));
}
