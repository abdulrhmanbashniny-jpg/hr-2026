import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { craftsmen, users } from '@/db/schema';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { codeFromParam, leadSource } from '@/lib/craftsmen/lookup';
import { recordLead } from '@/lib/craftsmen/service';
import { env } from '@/lib/env';
import { ApiError, route } from '@/lib/http';
import { getLocale } from '@/lib/i18n';
import { requestFingerprint } from '@/lib/signals';
import { inquiryMessage, whatsappLink } from '@/lib/whatsapp';

type Ctx = { params: Promise<{ code: string }> };

/**
 * The only way to reach a craftsman's number: a redirect that logs the lead. Numbers never appear
 * in page HTML, so scrapers get nothing, and every contact shows up in the craftsman's analytics.
 */
export const GET = route<Ctx>(
  async (req: NextRequest, { params }) => {
    const code = codeFromParam((await params).code);
    const channel = req.nextUrl.searchParams.get('channel') === 'call' ? 'call' : 'whatsapp';
    const fp = await requestFingerprint();
    if (!(await consume([{ key: `contact:${fp.ipHash ?? 'anon'}`, limit: 40, windowMs: HOUR }]))) throw new ApiError('rate_limited');
    const [c] = await db
      .select({ id: craftsmen.id, name: craftsmen.displayName, whatsapp: craftsmen.whatsapp, acceptsCalls: craftsmen.acceptsCalls, phone: users.phone, status: users.status })
      .from(craftsmen)
      .innerJoin(users, eq(users.id, craftsmen.userId))
      .where(eq(craftsmen.referralCode, code));
    if (!c || c.status !== 'active') throw new ApiError('not_found');
    const profileUrl = `${env.appUrl}/c/${code}`;
    await recordLead(c.id, channel, leadSource(req.nextUrl.searchParams.get('src')), fp.ipHash);
    if (channel === 'call') {
      if (!c.acceptsCalls) return NextResponse.redirect(profileUrl, 302);
      return new NextResponse(null, { status: 302, headers: { Location: `tel:${c.whatsapp ?? c.phone}`, 'Cache-Control': 'no-store' } });
    }
    const number = c.whatsapp ?? c.phone;
    const text = inquiryMessage(await getLocale(), { name: c.name, code, profileUrl });
    return NextResponse.redirect(whatsappLink(number, text), { status: 302, headers: { 'Cache-Control': 'no-store' } });
  },
  { csrf: false },
);
