import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { ok, readJson, route } from '@/lib/http';
import { LOCALE_COOKIE } from '@/lib/i18n';

const Body = z.object({ locale: z.enum(['ar', 'en']) });

export const POST = route(async (req) => {
  const { locale } = await readJson(req, Body);
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 365 * 86_400, sameSite: 'lax' });
  const s = await getSession();
  if (s) await db.update(users).set({ locale }).where(eq(users.id, s.user.id));
  return ok({ locale });
});
