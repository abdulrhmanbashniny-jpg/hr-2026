import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { CONTACT_CATEGORIES, cleanContactPhone, isContactCategory, type ContactCategory } from '@/lib/contact-categories';
import { staffCan, staffRoleOf } from '@/lib/admin/staff';
import { decryptSecret } from '@/lib/crypto';
import { env } from '@/lib/env';
import { emailEnabled, emailLayout, escapeHtml as escapeMailHtml, sendEmail } from '@/lib/notifications/email';
import { escapeHtml, platformBot, sendMessage, type InlineButton, type TelegramBot } from '@/lib/notifications/telegram';
import { normalizeSaudiPhone } from '@/lib/notifications/wa-link';
import { getPlatformTelegram } from '@/lib/platform-settings';


export { CONTACT_CATEGORIES, cleanContactPhone, isContactCategory, type ContactCategory };

const CATEGORY_AR: Record<ContactCategory, string> = { problem: 'مشكلة', improvement: 'تحسين وتطوير', other: 'أخرى' };

/** The bot and chats that receive platform alerts: the bot saved in the console, else the shared platform bot. */
export async function platformAlertTarget(): Promise<{ bot: TelegramBot; chatIds: string[] } | null> {
  const s = await getPlatformTelegram();
  if (!s?.enabled || !s.chatIds.length) return null;
  let bot: TelegramBot | null = null;
  if (s.botTokenEnc) {
    try {
      bot = { token: decryptSecret(s.botTokenEnc), username: s.botUsername || null, tenantId: null };
    } catch {
      bot = null;
    }
  }
  bot ??= platformBot();
  return bot ? { bot, chatIds: s.chatIds } : null;
}

export interface ContactNotice {
  name: string;
  phone: string;
  category: ContactCategory;
  message: string;
  tenantName: string | null;
  email: string | null;
}

/** Tells the platform team about a new message on Telegram and by e-mail, whichever is set up. */
export async function notifyContactMessage(msg: ContactNotice): Promise<{ telegram: number; email: number }> {
  const label = CATEGORY_AR[msg.category];
  const wa = normalizeSaudiPhone(msg.phone);
  const inbox = `${env.appUrl}/admin/inbox`;
  let telegram = 0;
  let email = 0;

  const target = await platformAlertTarget();
  if (target) {
    const text = [
      `📩 <b>رسالة جديدة من «تواصل معنا» · ${label}</b>`,
      '',
      `👤 ${escapeHtml(msg.name)}`,
      `📱 <code>${escapeHtml(msg.phone)}</code>`,
      msg.tenantName ? `🏢 ${escapeHtml(msg.tenantName)}` : null,
      msg.email ? `✉️ ${escapeHtml(msg.email)}` : null,
      '',
      escapeHtml(msg.message.slice(0, 3000)),
    ]
      .filter((l) => l !== null)
      .join('\n');
    // Telegram only accepts public https links on buttons.
    const row: InlineButton[] = [];
    if (inbox.startsWith('https://')) row.push({ text: 'فتح الرسائل', url: inbox });
    if (wa) row.push({ text: 'رد عبر واتساب', url: `https://wa.me/${wa}` });
    for (const chat of target.chatIds) {
      try {
        await sendMessage(target.bot, chat, text, row.length ? [row] : undefined);
        telegram++;
      } catch (err) {
        console.error('contact telegram alert failed', err);
      }
    }
  }

  if (await emailEnabled(null)) {
    const staff = await db
      .select({ email: users.email, isSuperAdmin: users.isSuperAdmin, staffRole: users.staffRole })
      .from(users)
      .where(and(eq(users.isSuperAdmin, true), isNull(users.disabledAt)));
    const body = `<p><b>${escapeMailHtml(label)}</b> من ${escapeMailHtml(msg.name)}${msg.tenantName ? ` (${escapeMailHtml(msg.tenantName)})` : ''}</p>
<p>الجوال: <span dir="ltr">${escapeMailHtml(msg.phone)}</span>${wa ? ` · <a href="https://wa.me/${wa}" style="color:#007aff">واتساب</a>` : ''}${msg.email ? `<br>البريد: ${escapeMailHtml(msg.email)}` : ''}</p>
<p style="white-space:pre-wrap;background:#f5f5f7;border-radius:12px;padding:12px 14px">${escapeMailHtml(msg.message)}</p>
<p><a href="${inbox}" style="color:#007aff">فتح رسائل «تواصل معنا»</a></p>`;
    for (const u of staff) {
      if (!staffCan(staffRoleOf(u), 'inbox:view')) continue;
      try {
        await sendEmail(null, {
          to: u.email,
          subject: `متابعة · تواصل معنا: ${label} من ${msg.name}`,
          html: emailLayout('رسالة جديدة', body, 'منصة متابعة'),
          text: `${label} من ${msg.name} (${msg.phone})\n\n${msg.message}\n\n${inbox}`,
        });
        email++;
      } catch (err) {
        console.error('contact e-mail alert failed', err);
      }
    }
  }
  return { telegram, email };
}
