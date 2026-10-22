import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { apiPortalUser } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';

export const POST = route(async (req) => {
  const s = await apiPortalUser();
  const { ids } = await readJson(req, z.object({ ids: z.array(z.uuid()).max(100).optional() }));
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, s.user.id), isNull(notifications.readAt), ids?.length ? inArray(notifications.id, ids) : undefined));
  return ok({ read: true });
});
