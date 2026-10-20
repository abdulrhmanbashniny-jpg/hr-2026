import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import { runDailyJob } from '@/lib/notifications/dispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily scheduler entry point. Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`;
 * self-hosted deployments can call it from system cron or run `npm run job:daily` instead.
 */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await runDailyJob();
  return NextResponse.json(result);
}
