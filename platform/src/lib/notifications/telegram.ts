import { decryptSecret } from '@/lib/crypto';
import { env } from '@/lib/env';
import type { TenantSettings } from '@/lib/settings';

/**
 * A Telegram bot the platform talks through: either the company's own bot (created with @BotFather and
 * saved in Settings → Notification channels) or the shared platform bot from the environment.
 */
export interface TelegramBot {
  token: string;
  username: string | null;
  /** Set for a company bot: that bot serves this company only. */
  tenantId: string | null;
}

export function platformBot(): TelegramBot | null {
  return env.telegram.botToken ? { token: env.telegram.botToken, username: env.telegram.botUsername || null, tenantId: null } : null;
}

export function tenantBot(settings: TenantSettings | null, tenantId: string | null): TelegramBot | null {
  const tg = settings?.telegram;
  if (!tenantId || !tg?.enabled || !tg.botTokenEnc) return null;
  try {
    return { token: decryptSecret(tg.botTokenEnc), username: tg.botUsername || null, tenantId };
  } catch {
    return null;
  }
}

/** The company's own bot when connected, otherwise the platform bot. */
export function botFor(settings: TenantSettings | null, tenantId: string | null): TelegramBot | null {
  return tenantBot(settings, tenantId) ?? platformBot();
}

export function telegramEnabled(settings: TenantSettings | null = null, tenantId: string | null = null): boolean {
  return !!botFor(settings, tenantId);
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

async function call<T = unknown>(token: string, method: string, body: Record<string, unknown> | FormData): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result as T;
}

export function sendMessage(bot: TelegramBot, chatId: string, text: string, buttons?: InlineButton[][]) {
  return call(bot.token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function sendDocument(bot: TelegramBot, chatId: string, file: { bytes: Uint8Array; name: string; mime: string }, caption: string) {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('caption', caption.slice(0, 1000));
  form.set('parse_mode', 'HTML');
  form.set('document', new Blob([file.bytes as BlobPart], { type: file.mime }), file.name);
  return call(bot.token, 'sendDocument', form);
}

export function answerCallback(bot: TelegramBot, callbackQueryId: string, text: string) {
  return call(bot.token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text: text.slice(0, 190) });
}

export function editMessageButtons(bot: TelegramBot, chatId: string | number, messageId: number, buttons: InlineButton[][] | null) {
  return call(bot.token, 'editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons ?? [] } });
}

export function setWebhook(bot: TelegramBot, url: string, secret: string) {
  return call(bot.token, 'setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'] });
}

export function deleteWebhook(bot: TelegramBot) {
  return call(bot.token, 'deleteWebhook', {});
}

export function setCommands(bot: TelegramBot) {
  return call(bot.token, 'setMyCommands', {
    commands: [
      { command: 'summary', description: 'ملخص امتثال الشركة' },
      { command: 'alerts', description: 'أهم التنبيهات المفتوحة' },
      { command: 'docs', description: 'قائمة المستندات لطلب أي مستند' },
      { command: 'chatid', description: 'معرّف هذه المحادثة' },
      { command: 'help', description: 'المساعدة' },
    ],
  });
}

/** Checks a token with Telegram and returns the bot's identity. */
export function getMe(token: string) {
  return call<{ id: number; username: string; first_name: string }>(token, 'getMe', {});
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function telegramDeepLink(bot: TelegramBot | null, code: string): string | null {
  return bot?.username ? `https://t.me/${bot.username}?start=${encodeURIComponent(code)}` : null;
}
