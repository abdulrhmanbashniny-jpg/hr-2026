'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getSession, setActiveTenant } from '@/lib/auth/session';
import { LOCALE_COOKIE, THEME_COOKIE } from '@/lib/i18n';
import { revalidatePath } from 'next/cache';

const YEAR = 365 * 86_400;

export async function setLocale(locale: 'ar' | 'en') {
  if (locale !== 'ar' && locale !== 'en') return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  const s = await getSession();
  if (s) await db.update(users).set({ locale }).where(eq(users.id, s.user.id));
  revalidatePath('/', 'layout');
}

export async function setTheme(theme: 'light' | 'dark' | 'system') {
  if (!['light', 'dark', 'system'].includes(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, { path: '/', maxAge: YEAR, sameSite: 'lax' });
}

export async function switchTenant(tenantId: string) {
  const s = await getSession();
  if (!s || !s.memberships.some((m) => m.tenantId === tenantId)) return;
  await setActiveTenant(tenantId);
  revalidatePath('/', 'layout');
}
