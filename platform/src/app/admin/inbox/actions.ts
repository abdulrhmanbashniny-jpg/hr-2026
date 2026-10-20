'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requireStaff } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

const STATUSES = ['new', 'in_progress', 'closed'] as const;

export async function setContactStatus(id: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('inbox:view');
    const { t } = await getI18n();
    if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: t.common.error };
    const next = status as (typeof STATUSES)[number];
    await db
      .update(contactMessages)
      .set({ status: next, handledBy: next === 'new' ? null : s.user.id, handledAt: next === 'new' ? null : new Date() })
      .where(eq(contactMessages.id, id));
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t.console.inbox.updated };
  });
}

export async function deleteContactMessage(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requireStaff('inbox:view');
    const { t } = await getI18n();
    const [row] = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning({ name: contactMessages.name });
    if (row) await audit({ tenantId: null, userId: s.user.id, action: 'admin.contact_deleted', summary: `حذف رسالة «تواصل معنا» من ${row.name}` });
    revalidatePath('/admin', 'layout');
    return { ok: true, message: t.console.inbox.deleted };
  });
}
