import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { safeEqual } from '@/lib/crypto';
import { handleTelegramUpdate, type TgUpdate } from '@/lib/notifications/bot';
import { tenantBot } from '@/lib/notifications/telegram';
import { resolveSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Webhook of one company's own bot: it answers with that company's data only. */
export async function POST(req: Request, ctx: RouteContext<'/api/telegram/webhook/[tenantId]'>) {
  const { tenantId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(tenantId)) return NextResponse.json({ ok: false }, { status: 404 });
  const [tenant] = await db.select({ id: tenants.id, settings: tenants.settings, suspendedAt: tenants.suspendedAt }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) return NextResponse.json({ ok: false }, { status: 404 });
  const settings = resolveSettings(tenant.settings);
  const bot = tenantBot(settings, tenant.id);
  const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!bot || !settings.telegram.webhookSecret || !safeEqual(got, settings.telegram.webhookSecret)) return NextResponse.json({ ok: false }, { status: 401 });
  if (tenant.suspendedAt) return NextResponse.json({ ok: true });
  try {
    await handleTelegramUpdate((await req.json()) as TgUpdate, { bot, tenantId: tenant.id });
  } catch (err) {
    console.error('telegram update failed', err);
  }
  return NextResponse.json({ ok: true });
}
