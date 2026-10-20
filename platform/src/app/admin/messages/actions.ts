'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { announcements, type AnnouncementAudience } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction, str } from '@/lib/actions';
import { publishAnnouncement } from '@/lib/admin/announcements';
import { audit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/guards';
import { countOf, f, getI18n } from '@/lib/i18n';

const LEVELS = ['info', 'success', 'warning', 'critical'] as const;
const KINDS: AnnouncementAudience['kind'][] = ['all', 'trialing', 'active', 'expired', 'plan', 'tenants'];
const CHANNELS = ['banner', 'in_app', 'email'] as const;

export async function sendAnnouncement(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('messages:send');
    const { t, locale } = await getI18n();
    const m = t.console.messages;
    const title = str(form, 'title').slice(0, 160);
    const body = str(form, 'body').slice(0, 4000);
    if (!title || !body) return { ok: false, error: m.needTitle };
    const level = str(form, 'level') as (typeof LEVELS)[number];
    const kind = str(form, 'audience') as AnnouncementAudience['kind'];
    if (!LEVELS.includes(level) || !KINDS.includes(kind)) return { ok: false, error: t.common.error };
    const channels = form.getAll('channels').map(String).filter((c): c is (typeof CHANNELS)[number] => (CHANNELS as readonly string[]).includes(c));
    if (!channels.length) return { ok: false, error: m.needChannel };
    const ids = (k: string) => form.getAll(k).map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v));
    const audience: AnnouncementAudience = { kind, ...(kind === 'plan' ? { planIds: ids('planIds') } : {}), ...(kind === 'tenants' ? { tenantIds: ids('tenantIds') } : {}) };
    const link = str(form, 'link');
    const endsAt = /^\d{4}-\d{2}-\d{2}$/.test(str(form, 'endsAt')) ? new Date(`${str(form, 'endsAt')}T23:59:59+03:00`) : null;
    const r = await publishAnnouncement({ title, body, level, audience, channels, link: /^https?:\/\//.test(link) ? link : null, endsAt, createdBy: s.user.id });
    if (!r) return { ok: false, error: m.noRecipients };
    await audit({ tenantId: kind === 'tenants' && audience.tenantIds?.length === 1 ? audience.tenantIds[0] : null, userId: s.user.id, action: 'admin.announcement_sent', entityType: 'announcement', entityId: r.id, summary: `إرسال رسالة «${title}» إلى ${r.tenantCount} شركة`, metadata: { ...r, channels, audience: kind } });
    revalidatePath('/admin', 'layout');
    const message = f(m.sent, { companies: countOf(r.tenantCount, 'company', locale), users: countOf(r.userCount, 'user', locale) }) + (channels.includes('email') && (r.emailSent || r.emailFailed) ? ` ${f(m.sentEmail, { sent: r.emailSent, failed: r.emailFailed })}` : '');
    return { ok: true, message };
  });
}

export async function stopAnnouncement(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('messages:send');
    const { t } = await getI18n();
    await db.update(announcements).set({ archivedAt: new Date() }).where(eq(announcements.id, id));
    await audit({ tenantId: null, userId: s.user.id, action: 'admin.announcement_stopped', entityType: 'announcement', entityId: id, summary: 'إيقاف شريط إعلان' });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t.console.messages.stopped };
  });
}
