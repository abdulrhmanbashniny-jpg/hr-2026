import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { documents, shareLinks } from '@/db/schema';
import { randomToken, sha256 } from '@/lib/crypto';
import { env } from '@/lib/env';
import { emailLayout, escapeHtml as escapeEmail, sendEmail, type MailAttachment } from '@/lib/notifications/email';
import { botFor, escapeHtml, sendDocument, sendMessage } from '@/lib/notifications/telegram';
import { sendWhatsApp, waDeepLink, whatsappAutomatic } from '@/lib/notifications/whatsapp';
import type { TenantSettings } from '@/lib/settings';
import { storage } from '@/lib/storage';

export type DocumentRecord = typeof documents.$inferSelect;
export type ShareChannel = 'email' | 'telegram' | 'whatsapp';

/** Link lifetimes offered when sharing; 0 means a permanent link. */
export const SHARE_EXPIRY_HOURS = [1, 3, 6, 12, 24, 72, 168, 720, 0] as const;
const MAX_EMAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function createShareLink(input: {
  tenantId: string;
  documentIds: string[];
  expiresInHours: number;
  recipient?: string | null;
  channel?: string | null;
  createdBy?: string | null;
}) {
  const token = randomToken(32);
  const expiresAt = input.expiresInHours > 0 ? new Date(Date.now() + input.expiresInHours * 3_600_000) : null;
  const [row] = await db
    .insert(shareLinks)
    .values({
      tenantId: input.tenantId,
      tokenHash: sha256(token),
      documentIds: input.documentIds,
      recipient: input.recipient ?? null,
      channel: input.channel ?? null,
      expiresAt,
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: shareLinks.id });
  return { id: row.id, token, url: `${env.appUrl}/s/${token}`, expiresAt };
}

/** Resolves a share token to its live link and the documents it grants. */
export async function resolveShareToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.tokenHash, sha256(token)));
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt < new Date())) return null;
  const docs = link.documentIds.length
    ? await db.select().from(documents).where(and(eq(documents.tenantId, link.tenantId), inArray(documents.id, link.documentIds)))
    : [];
  return { link, docs };
}

export async function readDocumentFile(doc: DocumentRecord) {
  if (!doc.fileKey) return null;
  const bytes = await storage().get(doc.fileKey);
  return { bytes, name: doc.fileName ?? `${doc.title}.pdf`, mime: doc.fileMime ?? 'application/octet-stream' };
}

export function documentCaption(doc: DocumentRecord): string {
  return `${doc.title}${doc.referenceNumber ? ` · رقم ${doc.referenceNumber}` : ''}${doc.expiryDate ? ` · ينتهي ${doc.expiryDate}` : ''}`;
}

export interface Recipient {
  name: string;
  email?: string | null;
  phone?: string | null;
  telegramChatId?: string | null;
}

export interface ShareResult {
  channel: ShareChannel;
  ok: boolean;
  error?: string;
  /** Hybrid WhatsApp: a ready wa.me link the user opens to send it themselves. */
  waLink?: string;
  linkUrl?: string;
}

/**
 * Sends documents to a person by e-mail, Telegram or WhatsApp, either as attachments or as one
 * time-limited secure link. WhatsApp always uses the link (deep-link mode returns it for the user to send).
 */
export async function shareDocuments(input: {
  tenantId: string;
  tenantName: string;
  settings: TenantSettings;
  docs: DocumentRecord[];
  recipient: Recipient;
  channels: ShareChannel[];
  mode: 'attachment' | 'link';
  expiresInHours: number;
  note?: string;
  createdBy: string | null;
}): Promise<ShareResult[]> {
  const results: ShareResult[] = [];
  const needLink = input.mode === 'link' || input.channels.includes('whatsapp') || input.docs.some((d) => !d.fileKey);
  const link = needLink
    ? await createShareLink({
        tenantId: input.tenantId,
        documentIds: input.docs.map((d) => d.id),
        expiresInHours: input.expiresInHours,
        recipient: input.recipient.name,
        channel: input.channels.join(','),
        createdBy: input.createdBy,
      })
    : null;
  const validity = !link ? '' : link.expiresAt ? `صالح حتى ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }).format(link.expiresAt)} بتوقيت الرياض` : 'رابط دائم';
  const list = input.docs.map((d) => `• ${documentCaption(d)}`).join('\n');
  const note = input.note?.trim() ? `${input.note.trim()}\n\n` : '';

  for (const channel of input.channels) {
    try {
      if (channel === 'email') {
        if (!input.recipient.email) throw new Error('no_email');
        const attachments: MailAttachment[] = [];
        if (input.mode === 'attachment') {
          let total = 0;
          for (const d of input.docs) {
            const f = await readDocumentFile(d);
            if (!f) continue;
            total += f.bytes.byteLength;
            if (total > MAX_EMAIL_ATTACHMENT_BYTES) throw new Error('attachments_too_large');
            attachments.push({ filename: f.name, content: Buffer.from(f.bytes), contentType: f.mime });
          }
        }
        const linkHtml = link ? `<p><a href="${link.url}" style="color:#0f5b4b">تحميل المستندات</a> (${validity})</p>` : '';
        await sendEmail(input.settings, {
          to: input.recipient.email,
          subject: `مستندات من ${input.tenantName}`,
          html: emailLayout(
            input.tenantName,
            `<p>مرحباً ${escapeEmail(input.recipient.name)}،</p>${note ? `<p>${escapeEmail(note)}</p>` : ''}<p>المستندات المرفقة:</p><ul>${input.docs.map((d) => `<li>${escapeEmail(documentCaption(d))}</li>`).join('')}</ul>${linkHtml}`,
            'أُرسلت هذه الرسالة عبر منصة متابعة.',
          ),
          text: `${note}${list}${link ? `\n\n${link.url}` : ''}`,
          attachments,
        });
        results.push({ channel, ok: true, linkUrl: link?.url });
      } else if (channel === 'telegram') {
        const bot = botFor(input.settings, input.tenantId);
        if (!bot) throw new Error('telegram_disabled');
        if (!input.recipient.telegramChatId) throw new Error('no_telegram');
        const chat = input.recipient.telegramChatId;
        if (input.mode === 'attachment') {
          for (const d of input.docs) {
            const f = await readDocumentFile(d);
            if (f) await sendDocument(bot, chat, f, escapeHtml(documentCaption(d)));
            else if (d.externalUrl) await sendMessage(bot, chat, `${escapeHtml(documentCaption(d))}\n${escapeHtml(d.externalUrl)}`);
          }
          if (note) await sendMessage(bot, chat, escapeHtml(note));
        } else {
          await sendMessage(bot, chat, `${escapeHtml(note)}<b>مستندات من ${escapeHtml(input.tenantName)}</b>\n${escapeHtml(list)}\n\n${validity}`, [[{ text: 'تحميل المستندات', url: link!.url }]]);
        }
        results.push({ channel, ok: true, linkUrl: link?.url });
      } else if (channel === 'whatsapp') {
        const text = `${note}مستندات من ${input.tenantName}:\n${list}\n\n${link!.url}\n(${validity})`;
        if (whatsappAutomatic(input.settings)) {
          if (!input.recipient.phone) throw new Error('no_phone');
          await sendWhatsApp(input.settings, input.recipient.phone, text, input.docs.length === 1 && input.docs[0].fileKey ? `${link!.url}/${input.docs[0].id}` : undefined);
          results.push({ channel, ok: true, linkUrl: link!.url });
        } else {
          results.push({ channel, ok: true, waLink: waDeepLink(input.recipient.phone, text), linkUrl: link!.url });
        }
      }
    } catch (err) {
      results.push({ channel, ok: false, error: err instanceof Error ? err.message : String(err), linkUrl: link?.url });
    }
  }
  return results;
}
