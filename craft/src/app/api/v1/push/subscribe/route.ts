import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { apiUser } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';

const Sub = z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export const POST = route(async (req) => {
  const s = await apiUser();
  const sub = await readJson(req, Sub);
  if (!sub.endpoint.startsWith('https://')) return ok({ subscribed: false });
  await db
    .insert(pushSubscriptions)
    .values({ userId: s.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: s.user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return ok({ subscribed: true }, { status: 201 });
});

export const DELETE = route(async (req) => {
  const s = await apiUser();
  const { endpoint } = await readJson(req, z.object({ endpoint: z.string().max(1000) }));
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, s.user.id), eq(pushSubscriptions.endpoint, endpoint)));
  return ok({ subscribed: false });
});
