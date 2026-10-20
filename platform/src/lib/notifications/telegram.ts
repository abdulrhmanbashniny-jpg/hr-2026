import { env } from '@/lib/env';

const api = (method: string) => `https://api.telegram.org/bot${env.telegram.botToken}/${method}`;

export function telegramEnabled(): boolean {
  return !!env.telegram.botToken;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

async function call<T = unknown>(method: string, body: Record<string, unknown> | FormData): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(api(method), {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result as T;
}

export function sendMessage(chatId: string, text: string, buttons?: InlineButton[][]) {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function sendDocument(chatId: string, file: { bytes: Uint8Array; name: string; mime: string }, caption: string) {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('caption', caption.slice(0, 1000));
  form.set('parse_mode', 'HTML');
  form.set('document', new Blob([file.bytes as BlobPart], { type: file.mime }), file.name);
  return call('sendDocument', form);
}

export function answerCallback(callbackQueryId: string, text: string) {
  return call('answerCallbackQuery', { callback_query_id: callbackQueryId, text: text.slice(0, 190) });
}

export function editMessageButtons(chatId: string | number, messageId: number, buttons: InlineButton[][] | null) {
  return call('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: buttons ?? [] } });
}

export function setWebhook(url: string, secret: string) {
  return call('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'] });
}

export function getMe() {
  return call<{ username: string; first_name: string }>('getMe', {});
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function telegramDeepLink(code: string): string | null {
  return env.telegram.botUsername ? `https://t.me/${env.telegram.botUsername}?start=${encodeURIComponent(code)}` : null;
}
