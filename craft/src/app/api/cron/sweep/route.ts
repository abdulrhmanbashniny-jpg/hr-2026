import { lt } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { otpChallenges } from '@/db/schema';
import { safeEqual } from '@/lib/crypto';
import { env } from '@/lib/env';
import { sweepStuckInvoices } from '@/lib/invoices/pipeline';
import { sweepUploads } from '@/lib/uploads';

export const maxDuration = 300;

/** Housekeeping: re-run stuck invoices, delete abandoned uploads and expired one-time codes. */
export async function GET(req: NextRequest) {
  const secret = env.cronSecret;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  const invoices = await sweepStuckInvoices();
  const uploads = await sweepUploads();
  await db.delete(otpChallenges).where(lt(otpChallenges.expiresAt, new Date(Date.now() - 86_400_000)));
  return NextResponse.json({ data: { invoices, uploads } });
}
