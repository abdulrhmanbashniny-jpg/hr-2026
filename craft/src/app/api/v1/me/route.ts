import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { wallets } from '@/db/schema';
import { apiUser } from '@/lib/auth/guards';
import { NO_STORE, ok, route } from '@/lib/http';

export const GET = route(async () => {
  const s = await apiUser();
  const [w] = s.craftsman ? await db.select().from(wallets).where(eq(wallets.craftsmanId, s.craftsman.id)) : [];
  return ok({ user: { id: s.user.id, phone: s.user.phone, name: s.user.name, role: s.user.role, locale: s.user.locale }, craftsman: s.craftsman, wallet: w ? { balance: w.balance, lifetimeEarned: w.lifetimeEarned } : null }, { headers: NO_STORE });
});
