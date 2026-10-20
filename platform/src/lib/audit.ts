import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { clientIp } from '@/lib/auth/session';

export interface AuditEntry {
  tenantId: string | null;
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}

/** Writes an audit trail entry. Never throws: auditing must not break the user's action. */
export async function audit(entry: AuditEntry, ip?: string | null) {
  try {
    await db.insert(auditLogs).values({
      tenantId: entry.tenantId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 1000),
      metadata: entry.metadata ?? null,
      ip: ip === undefined ? await clientIp() : ip,
    });
  } catch (err) {
    console.error('audit failed', err);
  }
}
