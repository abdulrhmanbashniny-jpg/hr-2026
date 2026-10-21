import { and, count, desc, eq, gt, inArray, lte, ne } from 'drizzle-orm';
import { db } from '@/db';
import { complianceAlerts, contacts, documents, residents, tenants, vehicles } from '@/db/schema';
import { audit } from '@/lib/audit';
import { addDays, daysUntil, todayRiyadh } from '@/lib/dates';
import { documentCaption, readDocumentFile } from '@/lib/documents/share';
import { normalizeArabic } from '@/lib/imports/normalize';
import { arRemaining } from '@/lib/rules/text';
import { resolveSettings, type TenantSettings } from '@/lib/settings';
import { answerCallback, editMessageButtons, escapeHtml, sendDocument, sendMessage, type TelegramBot } from './telegram';

interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}
interface TgMessage {
  message_id: number;
  chat: { id: number; type: string; title?: string };
  from?: TgUser;
  text?: string;
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; message?: TgMessage; data?: string };
}

/** Which bot received the update, and — for a company's own bot — the only company it may serve. */
export interface BotScope {
  bot: TelegramBot;
  tenantId: string | null;
}

const SNOOZE_DAYS = 3;
const MODULE_AR: Record<string, string> = { residents: 'الإقامات', gosi: 'التأمينات', fleet: 'المركبات', operating_cards: 'بطاقات التشغيل', driver_cards: 'بطاقات السائقين', documents: 'المستندات', cross: 'الربط المتقاطع' };

function helpText(perms: TenantSettings['telegram']) {
  return [
    '<b>أوامر بوت متابعة</b>',
    perms.allowSummary ? '/summary — ملخص امتثال الشركة' : null,
    perms.allowAlerts ? '/alerts — أهم التنبيهات المفتوحة' : null,
    perms.allowDocuments ? '/docs — قائمة المستندات لطلب أي مستند' : null,
    perms.allowDocuments ? 'أو اكتب اسم المستند مباشرة، مثل: السجل التجاري' : null,
    '/chatid — معرّف هذه المحادثة',
  ]
    .filter(Boolean)
    .join('\n');
}

interface Linked {
  contact: typeof contacts.$inferSelect;
  tenantName: string;
  settings: TenantSettings;
}

/**
 * Contacts linked to this chat that this bot may serve: a company bot only serves its own company; the
 * shared platform bot serves companies that have not connected a bot of their own.
 */
async function linkedFor(chatId: string, scope: BotScope): Promise<Linked[]> {
  const rows = await db
    .select({ contact: contacts, tenantName: tenants.name, settings: tenants.settings, suspendedAt: tenants.suspendedAt })
    .from(contacts)
    .innerJoin(tenants, eq(tenants.id, contacts.tenantId))
    .where(and(eq(contacts.telegramChatId, chatId), eq(contacts.isActive, true), scope.tenantId ? eq(contacts.tenantId, scope.tenantId) : undefined));
  return rows
    .map((r) => ({ contact: r.contact, tenantName: r.tenantName, settings: resolveSettings(r.settings), suspended: !!r.suspendedAt }))
    .filter((r) => !r.suspended && (scope.tenantId ? true : !(r.settings.telegram.enabled && r.settings.telegram.botTokenEnc)));
}

/** A group chat the company configured as its digest group; its members may ask for the summary and alerts. */
async function groupFor(chatId: string, scope: BotScope): Promise<Linked | null> {
  if (!scope.tenantId) return null;
  const [t] = await db.select().from(tenants).where(eq(tenants.id, scope.tenantId));
  if (!t) return null;
  const settings = resolveSettings(t.settings);
  if (settings.telegram.groupChatId !== chatId) return null;
  return { contact: { id: 'group', tenantId: t.id, name: 'group', canRequestDocuments: false } as typeof contacts.$inferSelect, tenantName: t.name, settings };
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

async function deliverDocument(scope: BotScope, chatId: string, doc: typeof documents.$inferSelect, contactId: string) {
  const caption = `<b>${escapeHtml(documentCaption(doc))}</b>\n${docStatusLine(doc)}`;
  const file = await readDocumentFile(doc);
  if (file) await sendDocument(scope.bot, chatId, file, caption);
  else if (doc.externalUrl) await sendMessage(scope.bot, chatId, `${caption}\n${escapeHtml(doc.externalUrl)}`);
  else await sendMessage(scope.bot, chatId, `${caption}\nلا يوجد ملف مرفق لهذا المستند.`);
  await audit({ tenantId: doc.tenantId, userId: null, action: 'document.telegram_delivered', entityType: 'document', entityId: doc.id, summary: `أُرسل «${doc.title}» عبر بوت التليجرام`, metadata: { contactId } }, null);
}

/** A compact compliance picture: open alerts by severity and module, and what expires within 30 days. */
async function summaryText(tenantId: string, tenantName: string): Promise<string> {
  const today = todayRiyadh();
  const in30 = addDays(today, 30);
  const [bySeverity, byModule, [iq], [lic], [insp], [docs]] = await Promise.all([
    db.select({ severity: complianceAlerts.severity, n: count() }).from(complianceAlerts).where(and(eq(complianceAlerts.tenantId, tenantId), eq(complianceAlerts.status, 'open'))).groupBy(complianceAlerts.severity),
    db.select({ module: complianceAlerts.module, n: count() }).from(complianceAlerts).where(and(eq(complianceAlerts.tenantId, tenantId), eq(complianceAlerts.status, 'open'))).groupBy(complianceAlerts.module),
    db.select({ n: count() }).from(residents).where(and(eq(residents.tenantId, tenantId), eq(residents.recordStatus, 'active'), lte(residents.iqamaExpiry, in30))),
    db.select({ n: count() }).from(vehicles).where(and(eq(vehicles.tenantId, tenantId), eq(vehicles.recordStatus, 'active'), lte(vehicles.licenseExpiry, in30))),
    db.select({ n: count() }).from(vehicles).where(and(eq(vehicles.tenantId, tenantId), eq(vehicles.recordStatus, 'active'), lte(vehicles.inspectionExpiry, in30))),
    db.select({ n: count() }).from(documents).where(and(eq(documents.tenantId, tenantId), ne(documents.status, 'archived'), lte(documents.expiryDate, in30))),
  ]);
  const sev = Object.fromEntries(bySeverity.map((r) => [r.severity, r.n])) as Record<string, number>;
  const total = bySeverity.reduce((s, r) => s + r.n, 0);
  return [
    `<b>ملخص ${escapeHtml(tenantName)}</b> — ${today}`,
    '',
    `<b>التنبيهات المفتوحة: ${total}</b>`,
    `🔴 حرجة ${sev.critical ?? 0} · 🟠 عالية ${sev.high ?? 0} · 🟡 متوسطة ${sev.medium ?? 0}`,
    byModule.length ? byModule.map((m) => `• ${MODULE_AR[m.module] ?? m.module}: ${m.n}`).join('\n') : null,
    '',
    '<b>ينتهي خلال 30 يوماً (أو منتهٍ)</b>',
    `• إقامات: ${iq.n}`,
    `• رخص سير: ${lic.n}`,
    `• فحص دوري: ${insp.n}`,
    `• مستندات: ${docs.n}`,
  ]
    .filter((x) => x !== null)
    .join('\n');
}

export async function handleTelegramUpdate(update: TgUpdate, scope: BotScope): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query, scope);
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const command = text.split(/\s+/)[0].replace(/@\w+$/, '').toLowerCase();
  const isPrivate = msg.chat.type === 'private';

  if (command === '/chatid') {
    await sendMessage(scope.bot, chatId, `معرّف هذه المحادثة: <code>${chatId}</code>${isPrivate ? '' : `\n(${escapeHtml(msg.chat.title ?? 'مجموعة')})`}`);
    return;
  }

  if (!isPrivate) {
    const group = await groupFor(chatId, scope);
    if (!group) return;
    const perms = group.settings.telegram;
    if (command === '/summary' && perms.allowSummary) await sendMessage(scope.bot, chatId, await summaryText(group.contact.tenantId, group.tenantName));
    else if (command === '/alerts' && perms.allowAlerts) await sendMessage(scope.bot, chatId, await alertsText([group.contact.tenantId]));
    else if (command === '/help' || command === '/start') await sendMessage(scope.bot, chatId, helpText({ ...perms, allowDocuments: false }));
    return;
  }

  if (command === '/start') {
    const code = text.split(/\s+/)[1];
    if (!code) {
      await sendMessage(scope.bot, chatId, 'مرحباً بك في بوت متابعة. افتح رابط الربط الخاص بك من صفحة «المسؤولون» في المنصة لربط حسابك.');
      return;
    }
    const [c] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.telegramLinkCode, code), gt(contacts.telegramLinkExpiresAt, new Date()), scope.tenantId ? eq(contacts.tenantId, scope.tenantId) : undefined));
    if (!c) {
      await sendMessage(scope.bot, chatId, 'رمز الربط غير صالح أو مستخدم. أنشئ رابطاً جديداً من المنصة.');
      return;
    }
    await db
      .update(contacts)
      .set({ telegramChatId: chatId, telegramUsername: msg.from?.username ?? null, telegramLinkCode: null, telegramLinkExpiresAt: null })
      .where(eq(contacts.id, c.id));
    const [t] = await db.select({ name: tenants.name, settings: tenants.settings }).from(tenants).where(eq(tenants.id, c.tenantId));
    await audit({ tenantId: c.tenantId, userId: null, action: 'contact.telegram_linked', entityType: 'contact', entityId: c.id, summary: `ربط ${c.name} حسابه في التليجرام` }, null);
    await sendMessage(scope.bot, chatId, `تم ربط حسابك يا ${escapeHtml(c.name)} بشركة <b>${escapeHtml(t?.name ?? '')}</b>. ستصلك التنبيهات هنا.\n\n${helpText(resolveSettings(t?.settings).telegram)}`);
    return;
  }

  const linked = await linkedFor(chatId, scope);
  if (!linked.length) {
    await sendMessage(scope.bot, chatId, 'هذا الحساب غير مرتبط بأي شركة على هذا البوت. استخدم رابط الربط من المنصة.');
    return;
  }

  if (command === '/help') {
    await sendMessage(scope.bot, chatId, helpText(linked[0].settings.telegram));
    return;
  }

  if (command === '/summary') {
    const allowed = linked.filter((l) => l.settings.telegram.allowSummary);
    if (!allowed.length) return void (await sendMessage(scope.bot, chatId, 'الملخص غير مفعّل لهذا البوت.'));
    for (const l of allowed) await sendMessage(scope.bot, chatId, await summaryText(l.contact.tenantId, l.tenantName));
    return;
  }

  if (command === '/alerts') {
    const tenantIds = linked.filter((l) => l.settings.telegram.allowAlerts).map((l) => l.contact.tenantId);
    if (!tenantIds.length) return void (await sendMessage(scope.bot, chatId, 'عرض التنبيهات غير مفعّل لهذا البوت.'));
    await sendMessage(scope.bot, chatId, await alertsText(tenantIds));
    return;
  }

  const allowed = linked.filter((l) => l.contact.canRequestDocuments && l.settings.telegram.allowDocuments);
  if (!allowed.length) {
    await sendMessage(scope.bot, chatId, 'ليست لديك صلاحية طلب المستندات. اطلبها من مسؤول المنصة.');
    return;
  }
  const docs = await availableDocuments(allowed.map((l) => l.contact.tenantId));
  const tenantName = new Map(allowed.map((l) => [l.contact.tenantId, l.tenantName]));
  const multiTenant = allowed.length > 1;
  const button = (d: (typeof docs)[number]) => [{ text: `${multiTenant ? `${tenantName.get(d.tenantId)} · ` : ''}${d.title}`.slice(0, 60), callback_data: `g:${d.id}` }];

  if (command === '/docs') {
    if (!docs.length) {
      await sendMessage(scope.bot, chatId, 'لا توجد مستندات بملفات مرفقة بعد.');
      return;
    }
    await sendMessage(scope.bot, chatId, '<b>اختر المستند المطلوب:</b>', docs.slice(0, 40).map(button));
    return;
  }

  const q = normalizeArabic(text.replace(/^\/\w+\s*/, ''));
  const matches = q.length >= 2 ? docs.filter((d) => normalizeArabic(d.title).includes(q) || q.includes(normalizeArabic(d.title))) : [];
  if (matches.length === 1) {
    const owner = allowed.find((l) => l.contact.tenantId === matches[0].tenantId)!;
    await deliverDocument(scope, chatId, matches[0], owner.contact.id);
    return;
  }
  if (matches.length > 1) {
    await sendMessage(scope.bot, chatId, `وجدنا ${matches.length} مستندات:`, matches.slice(0, 20).map(button));
    return;
  }
  await sendMessage(scope.bot, chatId, `لم نجد مستنداً باسم «${escapeHtml(text)}». أرسل /docs لعرض القائمة.`);
}

async function alertsText(tenantIds: string[]): Promise<string> {
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
  if (!top.length) return 'لا توجد تنبيهات مفتوحة. 👌';
  const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' } as const;
  return `<b>أهم ${top.length} تنبيهات من أصل ${total}</b>\n\n${top.map((a) => `${icon[a.severity]} ${escapeHtml(a.titleAr)} — ${escapeHtml(a.entityLabel)}`).join('\n')}`;
}

async function handleCallback(cb: NonNullable<TgUpdate['callback_query']>, scope: BotScope) {
  const data = cb.data ?? '';
  const chatId = String(cb.message?.chat.id ?? cb.from.id);
  const linked = await linkedFor(chatId, scope);
  const [kind, id] = data.split(':');
  if (!linked.length || !id || !/^[0-9a-f-]{36}$/.test(id)) {
    await answerCallback(scope.bot, cb.id, 'غير مصرح');
    return;
  }
  const byTenant = new Map(linked.map((l) => [l.contact.tenantId, l]));

  if (kind === 'g') {
    const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), ne(documents.status, 'archived')));
    const l = doc ? byTenant.get(doc.tenantId) : undefined;
    if (!doc || !l?.contact.canRequestDocuments || !l.settings.telegram.allowDocuments) {
      await answerCallback(scope.bot, cb.id, 'غير مصرح بطلب هذا المستند');
      return;
    }
    await answerCallback(scope.bot, cb.id, 'جارٍ الإرسال…');
    await deliverDocument(scope, chatId, doc, l.contact.id);
    return;
  }

  if (kind === 'r' || kind === 's') {
    const [alert] = await db.select().from(complianceAlerts).where(eq(complianceAlerts.id, id));
    const l = alert ? byTenant.get(alert.tenantId) : undefined;
    // A contact may act only on alerts of the modules they follow (the ones they are sent).
    const covers = !!l && (l.contact.modules.length === 0 || l.contact.modules.includes(alert!.module));
    if (!alert || !l || !covers) {
      await answerCallback(scope.bot, cb.id, 'التنبيه غير موجود');
      return;
    }
    if (!l.settings.telegram.allowActions) {
      await answerCallback(scope.bot, cb.id, 'الإجراءات من البوت غير مفعّلة لهذه الشركة');
      return;
    }
    const contact = l.contact;
    const now = new Date();
    if (kind === 'r') {
      await db.update(complianceAlerts).set({ status: 'acknowledged', acknowledgedAt: now }).where(eq(complianceAlerts.id, alert.id));
      if (alert.entityType === 'document' && alert.entityId) {
        await db.update(documents).set({ status: 'renewal_in_progress', updatedAt: now }).where(eq(documents.id, alert.entityId));
      }
      await audit({ tenantId: alert.tenantId, userId: null, action: 'alert.renewed_via_telegram', entityType: 'alert', entityId: alert.id, summary: `${contact.name} أكد تجديد: ${alert.titleAr} — ${alert.entityLabel}`, metadata: { contactId: contact.id } }, null);
      await answerCallback(scope.bot, cb.id, 'سُجّل التجديد. حدّث تاريخ الانتهاء في المنصة أو ارفع الملف الجديد.');
    } else {
      const until = new Date(now.getTime() + SNOOZE_DAYS * 86_400_000);
      await db.update(complianceAlerts).set({ status: 'snoozed', snoozedUntil: until }).where(eq(complianceAlerts.id, alert.id));
      await audit({ tenantId: alert.tenantId, userId: null, action: 'alert.snoozed_via_telegram', entityType: 'alert', entityId: alert.id, summary: `${contact.name} أجّل تنبيه: ${alert.titleAr} — ${alert.entityLabel}`, metadata: { contactId: contact.id, days: SNOOZE_DAYS } }, null);
      await answerCallback(scope.bot, cb.id, `تم التأجيل ${SNOOZE_DAYS} أيام.`);
    }
    if (cb.message) await editMessageButtons(scope.bot, cb.message.chat.id, cb.message.message_id, null).catch(() => undefined);
    return;
  }
  await answerCallback(scope.bot, cb.id, 'أمر غير معروف');
}
