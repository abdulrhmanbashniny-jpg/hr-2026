import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { cities, craftsmen, users } from '@/db/schema';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { codeFromParam, leadSource } from '@/lib/craftsmen/lookup';
import { recordLead } from '@/lib/craftsmen/service';
import { env } from '@/lib/env';
import { ApiError, route } from '@/lib/http';
import { dictionary, getLocale } from '@/lib/i18n';
import { requestFingerprint } from '@/lib/signals';
import { buildVCard } from '@/lib/vcard';

type Ctx = { params: Promise<{ code: string }> };

export const GET = route<Ctx>(
  async (req: NextRequest, { params }) => {
    const code = codeFromParam((await params).code);
    const fp = await requestFingerprint();
    if (!(await consume([{ key: `vcard:${fp.ipHash ?? 'anon'}`, limit: 20, windowMs: HOUR }]))) throw new ApiError('rate_limited');
    const [c] = await db
      .select({ c: craftsmen, phone: users.phone, status: users.status, cityAr: cities.nameAr, cityEn: cities.nameEn })
      .from(craftsmen)
      .innerJoin(users, eq(users.id, craftsmen.userId))
      .innerJoin(cities, eq(cities.id, craftsmen.cityId))
      .where(eq(craftsmen.referralCode, code));
    if (!c || c.status !== 'active') throw new ApiError('not_found');
    const locale = await getLocale();
    const t = dictionary(locale);
    await recordLead(c.c.id, 'vcard', leadSource(req.nextUrl.searchParams.get('src')), fp.ipHash);
    const card = buildVCard({
      name: c.c.displayName,
      title: t.tiers[c.c.tier],
      phone: c.c.acceptsCalls || c.c.whatsapp ? (c.c.whatsapp ?? c.phone) : null,
      url: `${env.appUrl}/c/${code}`,
      city: locale === 'ar' ? c.cityAr : c.cityEn,
      note: `${t.profile.memberNo} ${code} · ${t.profile.verifiedBy}`,
    });
    return new NextResponse(card, {
      headers: { 'content-type': 'text/vcard; charset=utf-8', 'content-disposition': `attachment; filename="hirfa-${code}.vcf"`, 'cache-control': 'private, no-store' },
    });
  },
  { csrf: false },
);
