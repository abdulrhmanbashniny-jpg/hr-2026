'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';

export async function markAllRead() {
  const s = await requireTenant();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, s.user.id), eq(notifications.tenantId, s.tenant.id), isNull(notifications.readAt)));
  revalidatePath('/app', 'layout');
}

export async function markRead(id: string) {
  const s = await requireTenant();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, s.user.id)));
  revalidatePath('/app', 'layout');
}
