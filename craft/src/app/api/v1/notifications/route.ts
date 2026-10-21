import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { apiUser } from '@/lib/auth/guards';
import { NO_STORE, ok, route } from '@/lib/http';

export const GET = route(async () => {
  const s = await apiUser();
  const [items, [{ unread }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, s.user.id)).orderBy(desc(notifications.createdAt)).limit(40),
    db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, s.user.id), isNull(notifications.readAt))),
  ]);
  return ok({ items, unread }, { headers: NO_STORE });
});
