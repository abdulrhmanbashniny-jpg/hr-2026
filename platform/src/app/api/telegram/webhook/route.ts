import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import { handleTelegramUpdate, type TgUpdate } from '@/lib/notifications/bot';
import { platformBot } from '@/lib/notifications/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Webhook of the shared platform bot. Telegram signs each call with the secret token set in setWebhook. */
export async function POST(req: Request) {
  const secret = env.telegram.webhookSecret;
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const bot = platformBot();
  if (!bot || !secret || !safeEqual(got, secret)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    await handleTelegramUpdate((await req.json()) as TgUpdate, { bot, tenantId: null });
  } catch (err) {
    console.error('telegram update failed', err);
  }
  // Always 200 so Telegram does not retry a poison update forever.
  return NextResponse.json({ ok: true });
}
