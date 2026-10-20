import { and, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  complianceAlerts,
  contacts,
  documents,
  memberships,
  notificationDeliveries,
  notifications,
  sessions,
  shareLinks,
  subscriptions,
  tenants,
  users,
} from '@/db/schema';
import { daysUntil, todayRiyadh } from '@/lib/dates';
import { env } from '@/lib/env';
import { modulesForRole, type Role } from '@/lib/auth/rbac';
import { subscriptionState, PAST_DUE_GRACE_DAYS } from '@/lib/billing/state';
import { syncTenantAlerts } from '@/lib/rules/sync';
import { resolveSettings, type TenantSettings } from '@/lib/settings';
import { emailEnabled, emailLayout, escapeHtml as escapeEmail, sendEmail } from './email';
import { botFor, escapeHtml, sendMessage } from './telegram';
import { sendWhatsApp, whatsappAutomatic } from './whatsapp';

type Alert = typeof complianceAlerts.$inferSelect;
type Contact = typeof contacts.$inferSelect;

const SEVERITY_ICON: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' };
const MAX_INDIVIDUAL_TELEGRAM = 8;

function isoWeek(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
}

/**
 * Decides whether an alert is due for a notification today and returns its dedupe key.
 * Dated alerts notify when the remaining days cross one of the thresholds (e.g. 60/30/7/4), once per
 * threshold; past-due items remind weekly. Undated findings notify once, when first opened.
 */
export function notificationKey(alert: Pick<Alert, 'fingerprint' | 'dueDate' | 'severity'>, thresholds: number[], today: string): string | null {
  if (!alert.dueDate) return alert.severity === 'info' ? null : `${alert.fingerprint}:once`;
  const days = daysUntil(alert.dueDate, today)!;
  if (days <= 0) return `${alert.fingerprint}:expired:${isoWeek(today)}`;
  const crossed = thresholds.filter((t) => days <= t);
  if (!crossed.length) return null;
  return `${alert.fingerprint}:t${Math.min(...crossed)}`;
}

async function claimDelivery(tenantId: string, dedupeKey: string, channel: 'in_app' | 'telegram' | 'whatsapp' | 'email', recipient: string): Promise<string | null> {
  const rows = await db
    .insert(notificationDeliveries)
    .values({ tenantId, dedupeKey, channel, recipient, status: 'sent' })
    .onConflictDoNothing()
    .returning({ id: notificationDeliveries.id });
  return rows[0]?.id ?? null;
}

async function markFailed(id: string, error: unknown) {
  await db
    .update(notificationDeliveries)
    .set({ status: 'failed', error: String(error instanceof Error ? error.message : error).slice(0, 500) })
    .where(eq(notificationDeliveries.id, id));
}

function telegramText(a: Alert): string {
  return `${SEVERITY_ICON[a.severity] ?? ''} <b>${escapeHtml(a.titleAr)}</b>\n${escapeHtml(a.entityLabel)}\n\n${escapeHtml(a.detailAr)}`;
}

function plainText(a: Alert): string {
  return `${SEVERITY_ICON[a.severity] ?? ''} ${a.titleAr} — ${a.entityLabel}\n${a.detailAr}`;
}

export interface DispatchStats {
  inApp: number;
  telegram: number;
  whatsapp: number;
  email: number;
  failed: number;
}

/** Sends due notifications for a tenant across in-app, Telegram, WhatsApp and e-mail. Idempotent per day. */
export async function dispatchTenant(tenantId: string, today = todayRiyadh(), opts: { external?: boolean } = {}): Promise<DispatchStats> {
  const stats: DispatchStats = { inApp: 0, telegram: 0, whatsapp: 0, email: 0, failed: 0 };
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) return stats;
  const settings = resolveSettings(tenant.settings);
  const now = new Date();

  const open = await db
    .select()
    .from(complianceAlerts)
    .where(and(eq(complianceAlerts.tenantId, tenantId), or(eq(complianceAlerts.status, 'open'), and(eq(complianceAlerts.status, 'snoozed'), lt(complianceAlerts.snoozedUntil, now)))));
  if (!open.length) return stats;

  const docIds = open.filter((a) => a.entityType === 'document' && a.entityId).map((a) => a.entityId!);
  const docs = docIds.length ? await db.select().from(documents).where(inArray(documents.id, docIds)) : [];
  const docById = new Map(docs.map((d) => [d.id, d]));

  const members = await db
    .select({ userId: memberships.userId, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.tenantId, tenantId));
  const people = await db.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.isActive, true)));

  const due: { alert: Alert; key: string }[] = [];
  for (const alert of open) {
    const doc = alert.entityId ? docById.get(alert.entityId) : undefined;
    const thresholds = alert.entityType === 'document' && doc ? doc.alertDays : settings.templateAlertDays;
    const key = notificationKey(alert, thresholds, today);
    if (key) due.push({ alert, key });
  }

  // In-app fan-out to members responsible for the module.
  for (const { alert, key } of due) {
    for (const m of members) {
      if (!modulesForRole(m.role as Role).includes(alert.module)) continue;
      const claim = await claimDelivery(tenantId, key, 'in_app', m.userId);
      if (!claim) continue;
      await db.insert(notifications).values({
        tenantId,
        userId: m.userId,
        alertId: alert.id,
        titleAr: alert.titleAr,
        titleEn: alert.titleEn,
        bodyAr: `${alert.entityLabel} — ${alert.detailAr}`,
        bodyEn: `${alert.entityLabel} — ${alert.detailEn}`,
        link: alert.link,
        severity: alert.severity,
      });
      stats.inApp++;
    }
  }

  if (opts.external === false) return stats;

  // External channels: group per contact so a big first import does not flood anyone.
  const perContact = new Map<string, { contact: Contact; items: { alert: Alert; key: string }[] }>();
  for (const item of due) {
    if (item.alert.severity === 'info') continue;
    const doc = item.alert.entityId ? docById.get(item.alert.entityId) : undefined;
    for (const c of people) {
      const subscribed = c.modules.length === 0 || c.modules.includes(item.alert.module);
      const responsible = doc?.responsibleContactId === c.id;
      if (!subscribed && !responsible) continue;
      const entry = perContact.get(c.id) ?? { contact: c, items: [] };
      entry.items.push(item);
      perContact.set(c.id, entry);
    }
  }

  const tgBot = botFor(settings, tenantId);
  const tgActions = settings.telegram.allowActions;
  const waOn = whatsappAutomatic(settings);
  const mailOn = await emailEnabled(settings);

  for (const { contact, items } of perContact.values()) {
    // Telegram: individual messages with action buttons for the most urgent, a digest for the rest.
    if (tgBot && contact.telegramChatId) {
      const fresh: { alert: Alert; claim: string }[] = [];
      for (const it of items) {
        const claim = await claimDelivery(tenantId, it.key, 'telegram', contact.id);
        if (claim) fresh.push({ alert: it.alert, claim });
      }
      for (const [i, f] of fresh.entries()) {
        try {
          if (i < MAX_INDIVIDUAL_TELEGRAM) {
            await sendMessage(tgBot, contact.telegramChatId, telegramText(f.alert), [
              ...(tgActions
                ? [
                    [
                      { text: '✅ تم التجديد', callback_data: `r:${f.alert.id}` },
                      { text: '⏰ تأجيل 3 أيام', callback_data: `s:${f.alert.id}` },
                    ],
                  ]
                : []),
              [{ text: 'فتح في المنصة', url: `${env.appUrl}${f.alert.link ?? '/app/alerts'}` }],
            ]);
          }
          stats.telegram++;
        } catch (err) {
          stats.failed++;
          await markFailed(f.claim, err);
        }
      }
      if (fresh.length > MAX_INDIVIDUAL_TELEGRAM) {
        const rest = fresh.slice(MAX_INDIVIDUAL_TELEGRAM);
        const lines = rest.slice(0, 30).map((f) => `${SEVERITY_ICON[f.alert.severity]} ${escapeHtml(f.alert.titleAr)} — ${escapeHtml(f.alert.entityLabel)}`);
        try {
          await sendMessage(
            tgBot,
            contact.telegramChatId,
            `<b>${rest.length} تنبيهات أخرى لـ ${escapeHtml(tenant.name)}</b>\n${lines.join('\n')}${rest.length > 30 ? '\n…' : ''}`,
            [[{ text: 'عرض كل التنبيهات', url: `${env.appUrl}/app/alerts` }]],
          );
        } catch (err) {
          console.error('telegram digest failed', err);
        }
      }
    }

    // WhatsApp (automatic mode): one digest per run.
    if (waOn && contact.phone) {
      const fresh: { alert: Alert; claim: string }[] = [];
      for (const it of items) {
        const claim = await claimDelivery(tenantId, it.key, 'whatsapp', contact.id);
        if (claim) fresh.push({ alert: it.alert, claim });
      }
      if (fresh.length) {
        const text = `متابعة · ${tenant.name}\n\n${fresh.slice(0, 15).map((f) => plainText(f.alert)).join('\n\n')}${fresh.length > 15 ? `\n\n+${fresh.length - 15} تنبيهات أخرى` : ''}\n\n${env.appUrl}/app/alerts`;
        try {
          await sendWhatsApp(settings, contact.phone, text);
          stats.whatsapp += fresh.length;
        } catch (err) {
          stats.failed += fresh.length;
          for (const f of fresh) await markFailed(f.claim, err);
        }
      }
    }

    // E-mail: one digest per run.
    if (mailOn && contact.email) {
      const fresh: { alert: Alert; claim: string }[] = [];
      for (const it of items) {
        const claim = await claimDelivery(tenantId, it.key, 'email', contact.id);
        if (claim) fresh.push({ alert: it.alert, claim });
      }
      if (fresh.length) {
        const rows = fresh
          .map(
            (f) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #efebe4">${SEVERITY_ICON[f.alert.severity]} <b>${escapeEmail(f.alert.titleAr)}</b><br>${escapeEmail(f.alert.entityLabel)}<br><span style="color:#5e6166">${escapeEmail(f.alert.detailAr)}</span></td></tr>`,
          )
          .join('');
        try {
          await sendEmail(settings, {
            to: contact.email,
            subject: `متابعة · ${fresh.length} تنبيه امتثال — ${tenant.name}`,
            html: emailLayout(
              tenant.name,
              `<p>مرحباً ${escapeEmail(contact.name)}،</p><p>هذه التنبيهات المستحقة اليوم:</p><table role="presentation" width="100%">${rows}</table><p><a href="${env.appUrl}/app/alerts" style="color:#0f5b4b">عرض التنبيهات في المنصة</a></p>`,
              'وصلتك هذه الرسالة لأنك مسؤول متابعة في منصة متابعة.',
            ),
            text: fresh.map((f) => plainText(f.alert)).join('\n\n'),
          });
          stats.email += fresh.length;
        } catch (err) {
          stats.failed += fresh.length;
          for (const f of fresh) await markFailed(f.claim, err);
        }
      }
    }
  }

  // Company group chat: one digest per run of everything newly due.
  const group = settings.telegram.groupChatId;
  if (tgBot && group) {
    const fresh: { alert: Alert; claim: string }[] = [];
    for (const it of due) {
      if (it.alert.severity === 'info') continue;
      const claim = await claimDelivery(tenantId, it.key, 'telegram', `group:${group}`);
      if (claim) fresh.push({ alert: it.alert, claim });
    }
    if (fresh.length) {
      const lines = fresh.slice(0, 40).map((f) => `${SEVERITY_ICON[f.alert.severity]} ${escapeHtml(f.alert.titleAr)} — ${escapeHtml(f.alert.entityLabel)}`);
      try {
        await sendMessage(tgBot, group, `<b>تنبيهات ${escapeHtml(tenant.name)} المستحقة اليوم (${fresh.length})</b>\n${lines.join('\n')}${fresh.length > 40 ? '\n…' : ''}`, [[{ text: 'عرض كل التنبيهات', url: `${env.appUrl}/app/alerts` }]]);
        stats.telegram += fresh.length;
      } catch (err) {
        stats.failed += fresh.length;
        for (const f of fresh) await markFailed(f.claim, err);
      }
    }
  }

  return stats;
}

/** Weekly e-mail report for contacts who opted in. */
export async function sendWeeklyReport(tenantId: string, settings: TenantSettings, today: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant || !(await emailEnabled(settings))) return 0;
  const recipients = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.tenantId, tenantId), eq(contacts.isActive, true), eq(contacts.receiveWeeklyReport, true), isNotNull(contacts.email)));
  if (!recipients.length) return 0;
  const open = await db
    .select()
    .from(complianceAlerts)
    .where(and(eq(complianceAlerts.tenantId, tenantId), inArray(complianceAlerts.status, ['open', 'acknowledged', 'snoozed'])));
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 } as Record<string, number>;
  for (const a of open) counts[a.severity]++;
  const upcoming = open
    .filter((a) => a.dueDate && (daysUntil(a.dueDate, today) ?? 99) <= 30)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    .slice(0, 25);
  let sent = 0;
  for (const c of recipients) {
    const claim = await claimDelivery(tenantId, `weekly:${today}`, 'email', c.id);
    if (!claim) continue;
    try {
      await sendEmail(settings, {
        to: c.email!,
        subject: `متابعة · التقرير الأسبوعي — ${tenant.name}`,
        html: emailLayout(
          'التقرير الأسبوعي',
          `<p>ملخص الامتثال لـ <b>${escapeEmail(tenant.name)}</b> بتاريخ ${today}:</p>
<p>🔴 حرجة: ${counts.critical} · 🟠 عالية: ${counts.high} · 🟡 متوسطة: ${counts.medium} · 🔵 منخفضة: ${counts.low}</p>
<p><b>ما يستحق خلال 30 يوماً:</b></p><ul>${upcoming.map((a) => `<li>${escapeEmail(a.titleAr)} — ${escapeEmail(a.entityLabel)} (${a.dueDate})</li>`).join('') || '<li>لا شيء</li>'}</ul>
<p><a href="${env.appUrl}/app" style="color:#0f5b4b">افتح لوحة المتابعة</a></p>`,
          'تقرير أسبوعي آلي من منصة متابعة.',
        ),
        text: `التقرير الأسبوعي — ${tenant.name}\nحرجة ${counts.critical}، عالية ${counts.high}، متوسطة ${counts.medium}، منخفضة ${counts.low}`,
      });
      sent++;
    } catch (err) {
      await markFailed(claim, err);
    }
  }
  return sent;
}

/** Advances subscription states: ended trials → expired; unpaid periods → past_due → expired. */
export async function advanceSubscriptions(now = new Date()) {
  const subs = await db.select().from(subscriptions);
  let changed = 0;
  for (const s of subs) {
    let next: typeof s.status | null = null;
    if (s.status === 'trialing' && s.trialEndsAt && s.trialEndsAt <= now) next = 'expired';
    if (s.status === 'active' && s.currentPeriodEnd && s.currentPeriodEnd <= now) next = s.cancelAtPeriodEnd ? 'canceled' : 'past_due';
    if (s.status === 'past_due' && s.currentPeriodEnd && s.currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000 <= now.getTime()) next = 'expired';
    if (next && next !== s.status) {
      await db.update(subscriptions).set({ status: next, updatedAt: now }).where(eq(subscriptions.id, s.id));
      changed++;
    }
  }
  return changed;
}

export async function cleanup(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000);
  await db.delete(shareLinks).where(lt(shareLinks.expiresAt, cutoff));
  await db.delete(sessions).where(or(lt(sessions.expiresAt, now), lt(sessions.revokedAt, cutoff)));
  await db.delete(notifications).where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, new Date(now.getTime() - 120 * 86_400_000))));
}

export interface DailyJobResult {
  tenants: number;
  opened: number;
  resolved: number;
  delivered: DispatchStats;
  subscriptionsChanged: number;
  weeklyReports: number;
  errors: { tenantId: string; error: string }[];
}

/** The daily job: subscription states, rule evaluation, notifications, weekly reports, cleanup. */
export async function runDailyJob(now = new Date()): Promise<DailyJobResult> {
  const today = todayRiyadh(now);
  const result: DailyJobResult = {
    tenants: 0,
    opened: 0,
    resolved: 0,
    delivered: { inApp: 0, telegram: 0, whatsapp: 0, email: 0, failed: 0 },
    subscriptionsChanged: await advanceSubscriptions(now),
    weeklyReports: 0,
    errors: [],
  };
  const all = await db.select().from(tenants);
  const subs = await db.select().from(subscriptions);
  const subByTenant = new Map(subs.map((s) => [s.tenantId, s]));
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  for (const t of all) {
    if (t.suspendedAt) continue;
    result.tenants++;
    try {
      const sync = await syncTenantAlerts(t.id, today);
      result.opened += sync.opened.length;
      result.resolved += sync.resolved;
      const sub = subByTenant.get(t.id);
      const external = !!sub && subscriptionState(sub, now).canWrite;
      const d = await dispatchTenant(t.id, today, { external });
      for (const k of Object.keys(d) as (keyof DispatchStats)[]) result.delivered[k] += d[k];
      const settings = resolveSettings(t.settings);
      if (external && settings.weeklyReportDay === weekday) result.weeklyReports += await sendWeeklyReport(t.id, settings, today);
    } catch (err) {
      result.errors.push({ tenantId: t.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  await cleanup(now);
  return result;
}

export async function usersById(ids: string[]) {
  if (!ids.length) return new Map<string, typeof users.$inferSelect>();
  const rows = await db.select().from(users).where(inArray(users.id, ids));
  return new Map(rows.map((u) => [u.id, u]));
}
