import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/db';
import { complianceAlerts, contacts, documents, tenants } from '@/db/schema';
import { audit } from '@/lib/audit';
import { daysUntil, todayRiyadh } from '@/lib/dates';
import { documentCaption, readDocumentFile } from '@/lib/documents/share';
import { normalizeArabic } from '@/lib/imports/normalize';
import { arRemaining } from '@/lib/rules/text';
import { answerCallback, editMessageButtons, escapeHtml, sendDocument, sendMessage } from './telegram';

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; message?: TgMessage; data?: string };
}

const SNOOZE_DAYS = 3;
const HELP = [
  '<b>أوامر بوت متابعة</b>',
  '/docs — قائمة مستندات الشركة لطلب أي مستند',
  '/alerts — أهم التنبيهات المفتوحة',
  'أو اكتب اسم المستند مباشرة، مثل: السجل التجاري',
].join('\n');

async function contactsForChat(chatId: string) {
  return db
    .select({ contact: contacts, tenantName: tenants.name })
    .from(contacts)
    .innerJoin(tenants, eq(tenants.id, contacts.tenantId))
    .where(and(eq(contacts.telegramChatId, chatId), eq(contacts.isActive, true)));
}

async function availableDocuments(tenantIds: string[]) {
  if (!tenantIds.length) return [];
  const rows = await db
    .select()
    .from(documents)
    .where(and(inArray(documents.tenantId, tenantIds), ne(documents.status, 'archived')))
    .orderBy(documents.title);
  return rows.filter((d) => d.fileKey || d.externalUrl);
}

function docStatusLine(d: typeof documents.$inferSelect): string {
  if (!d.expiryDate) return 'بلا تاريخ انتهاء';
  const days = daysUntil(d.expiryDate, todayRiyadh())!;
  return `${days <= 0 ? '🔴' : days <= 30 ? '🟠' : days <= 90 ? '🟡' : '🟢'} ${arRemaining(days)} (${d.expiryDate})`;
}

async function deliverDocument(chatId: string, doc: typeof documents.$inferSelect, contactId: string) {
  const caption = `<b>${escapeHtml(documentCaption(doc))}</b>\n${docStatusLine(doc)}`;
  const file = await readDocumentFile(doc);
  if (file) await sendDocument(chatId, file, caption);
  else if (doc.externalUrl) await sendMessage(chatId, `${caption}\n${escapeHtml(doc.externalUrl)}`);
  else await sendMessage(chatId, `${caption}\nلا يوجد ملف مرفق لهذا المستند.`);
  await audit({ tenantId: doc.tenantId, userId: null, action: 'document.telegram_delivered', entityType: 'document', entityId: doc.id, summary: `أُرسل «${doc.title}» عبر بوت التليجرام`, metadata: { contactId } }, null);
}

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg?.text || msg.chat.type !== 'private') return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();

  if (text.startsWith('/start')) {
    const code = text.split(/\s+/)[1];
    if (!code) {
      await sendMessage(chatId, 'مرحباً بك في بوت متابعة. افتح رابط الربط من صفحة «المسؤولون» في المنصة لربط حسابك.');
      return;
    }
    const [c] = await db.select().from(contacts).where(eq(contacts.telegramLinkCode, code));
    if (!c) {
      await sendMessage(chatId, 'رمز الربط غير صالح أو مستخدم. أنشئ رابطاً جديداً من المنصة.');
      return;
    }
    await db
      .update(contacts)
      .set({ telegramChatId: chatId, telegramUsername: msg.from?.username ?? null, telegramLinkCode: null })
      .where(eq(contacts.id, c.id));
    const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, c.tenantId));
    await audit({ tenantId: c.tenantId, userId: null, action: 'contact.telegram_linked', entityType: 'contact', entityId: c.id, summary: `ربط ${c.name} حسابه في التليجرام` }, null);
    await sendMessage(chatId, `تم ربط حسابك يا ${escapeHtml(c.name)} بشركة <b>${escapeHtml(t?.name ?? '')}</b>. ستصلك التنبيهات هنا.\n\n${HELP}`);
    return;
  }

  const linked = await contactsForChat(chatId);
  if (!linked.length) {
    await sendMessage(chatId, 'هذا الحساب غير مرتبط بأي شركة. استخدم رابط الربط من المنصة.');
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId, HELP);
    return;
  }

  if (text === '/alerts') {
    const tenantIds = linked.map((l) => l.contact.tenantId);
    const open = await db
      .select()
      .from(complianceAlerts)
      .where(and(inArray(complianceAlerts.tenantId, tenantIds), eq(complianceAlerts.status, 'open')))
      .orderBy(complianceAlerts.dueDate, desc(complianceAlerts.lastSeenAt))
      .limit(200);
    const [{ total }] = await db
      .select({ total: count() })
      .from(complianceAlerts)
      .where(and(inArray(complianceAlerts.tenantId, tenantIds), eq(complianceAlerts.status, 'open')));
    const rank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
    const top = open.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 10);
    if (!top.length) {
      await sendMessage(chatId, 'لا توجد تنبيهات مفتوحة. 👌');
      return;
    }
    const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' } as const;
    await sendMessage(chatId, `<b>أهم ${top.length} تنبيهات من أصل ${total}</b>\n\n${top.map((a) => `${icon[a.severity]} ${escapeHtml(a.titleAr)} — ${escapeHtml(a.entityLabel)}`).join('\n')}`);
    return;
  }

  const allowed = linked.filter((l) => l.contact.canRequestDocuments);
  if (!allowed.length) {
    await sendMessage(chatId, 'ليست لديك صلاحية طلب المستندات. اطلبها من مسؤول المنصة.');
    return;
  }
  const docs = await availableDocuments(allowed.map((l) => l.contact.tenantId));
  const tenantName = new Map(allowed.map((l) => [l.contact.tenantId, l.tenantName]));
  const multiTenant = allowed.length > 1;
  const button = (d: (typeof docs)[number]) => [{ text: `${multiTenant ? `${tenantName.get(d.tenantId)} · ` : ''}${d.title}`.slice(0, 60), callback_data: `g:${d.id}` }];

  if (text === '/docs') {
    if (!docs.length) {
      await sendMessage(chatId, 'لا توجد مستندات بملفات مرفقة بعد.');
      return;
    }
    await sendMessage(chatId, '<b>اختر المستند المطلوب:</b>', docs.slice(0, 40).map(button));
    return;
  }

  const q = normalizeArabic(text.replace(/^\/\w+\s*/, ''));
  const matches = q.length >= 2 ? docs.filter((d) => normalizeArabic(d.title).includes(q) || q.includes(normalizeArabic(d.title))) : [];
  if (matches.length === 1) {
    const owner = allowed.find((l) => l.contact.tenantId === matches[0].tenantId)!;
    await deliverDocument(chatId, matches[0], owner.contact.id);
    return;
  }
  if (matches.length > 1) {
    await sendMessage(chatId, `وجدنا ${matches.length} مستندات:`, matches.slice(0, 20).map(button));
    return;
  }
  await sendMessage(chatId, `لم نجد مستنداً باسم «${escapeHtml(text)}». أرسل /docs لعرض القائمة.`);
}

async function handleCallback(cb: NonNullable<TgUpdate['callback_query']>) {
  const data = cb.data ?? '';
  const chatId = String(cb.message?.chat.id ?? cb.from.id);
  const linked = await contactsForChat(chatId);
  const [kind, id] = data.split(':');
  if (!linked.length || !id || !/^[0-9a-f-]{36}$/.test(id)) {
    await answerCallback(cb.id, 'غير مصرح');
    return;
  }
  const byTenant = new Map(linked.map((l) => [l.contact.tenantId, l.contact]));

  if (kind === 'g') {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    const contact = doc ? byTenant.get(doc.tenantId) : undefined;
    if (!doc || !contact?.canRequestDocuments) {
      await answerCallback(cb.id, 'غير مصرح بطلب هذا المستند');
      return;
    }
    await answerCallback(cb.id, 'جارٍ الإرسال…');
    await deliverDocument(chatId, doc, contact.id);
    return;
  }

  if (kind === 'r' || kind === 's') {
    const [alert] = await db.select().from(complianceAlerts).where(eq(complianceAlerts.id, id));
    const contact = alert ? byTenant.get(alert.tenantId) : undefined;
    if (!alert || !contact) {
      await answerCallback(cb.id, 'التنبيه غير موجود');
      return;
    }
    const now = new Date();
    if (kind === 'r') {
      await db.update(complianceAlerts).set({ status: 'acknowledged', acknowledgedAt: now }).where(eq(complianceAlerts.id, alert.id));
      if (alert.entityType === 'document' && alert.entityId) {
        await db.update(documents).set({ status: 'renewal_in_progress', updatedAt: now }).where(eq(documents.id, alert.entityId));
      }
      await audit({ tenantId: alert.tenantId, userId: null, action: 'alert.renewed_via_telegram', entityType: 'alert', entityId: alert.id, summary: `${contact.name} أكد تجديد: ${alert.titleAr} — ${alert.entityLabel}`, metadata: { contactId: contact.id } }, null);
      await answerCallback(cb.id, 'سُجّل التجديد. حدّث تاريخ الانتهاء في المنصة أو ارفع الملف الجديد.');
    } else {
      const until = new Date(now.getTime() + SNOOZE_DAYS * 86_400_000);
      await db.update(complianceAlerts).set({ status: 'snoozed', snoozedUntil: until }).where(eq(complianceAlerts.id, alert.id));
      await audit({ tenantId: alert.tenantId, userId: null, action: 'alert.snoozed_via_telegram', entityType: 'alert', entityId: alert.id, summary: `${contact.name} أجّل تنبيه: ${alert.titleAr} — ${alert.entityLabel}`, metadata: { contactId: contact.id, days: SNOOZE_DAYS } }, null);
      await answerCallback(cb.id, `تم التأجيل ${SNOOZE_DAYS} أيام.`);
    }
    if (cb.message) await editMessageButtons(cb.message.chat.id, cb.message.message_id, null).catch(() => undefined);
    return;
  }
  await answerCallback(cb.id, 'أمر غير معروف');
}
