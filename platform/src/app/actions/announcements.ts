'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { announcementDismissals } from '@/db/schema';
import { audit } from '@/lib/audit';
import { requireUser } from '@/lib/auth/guards';
import { getSession, setActiveTenant } from '@/lib/auth/session';

export async function dismissAnnouncement(id: string): Promise<void> {
  const s = await requireUser();
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await db.insert(announcementDismissals).values({ announcementId: id, userId: s.user.id }).onConflictDoNothing();
  revalidatePath('/app', 'layout');
}

/** Leaves a customer's workspace after support access and returns to the console. */
export async function exitSupport(): Promise<void> {
  const s = await getSession();
  if (s?.supportMode && s.tenant) {
    await setActiveTenant(null);
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'admin.support_exited', entityType: 'tenant', entityId: s.tenant.id, summary: `خروج مسؤول المنصة ${s.user.name} من مساحة العمل` });
  }
  redirect('/admin');
}
