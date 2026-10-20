'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { complianceAlerts } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export async function alertAction(ids: string[], op: 'acknowledge' | 'snooze3' | 'snooze7' | 'reopen'): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('alerts:manage');
    const { t } = await getI18n();
    const clean = ids.filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
    if (!clean.length) return { ok: true };
    const now = new Date();
    const set =
      op === 'acknowledge'
        ? { status: 'acknowledged' as const, acknowledgedAt: now, acknowledgedBy: s.user.id, snoozedUntil: null }
        : op === 'reopen'
          ? { status: 'open' as const, acknowledgedAt: null, acknowledgedBy: null, snoozedUntil: null }
          : { status: 'snoozed' as const, snoozedUntil: new Date(now.getTime() + (op === 'snooze3' ? 3 : 7) * 86_400_000) };
    const rows = await db
      .update(complianceAlerts)
      .set(set)
      .where(and(eq(complianceAlerts.tenantId, s.tenant.id), inArray(complianceAlerts.id, clean)))
      .returning({ id: complianceAlerts.id, title: complianceAlerts.titleAr, label: complianceAlerts.entityLabel });
    await audit({
      tenantId: s.tenant.id,
      userId: s.user.id,
      action: `alert.${op}`,
      entityType: 'alert',
      entityId: rows.length === 1 ? rows[0].id : undefined,
      summary: `${op} — ${rows.map((r) => `${r.title}: ${r.label}`).slice(0, 5).join('، ')}${rows.length > 5 ? ` (+${rows.length - 5})` : ''}`,
      metadata: { count: rows.length },
    });
    revalidatePath('/app', 'layout');
    return { ok: true, message: t.common.saved };
  });
}
