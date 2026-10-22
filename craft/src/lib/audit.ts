import { db, type DbOrTx } from '@/db';
import { auditLog } from '@/db/schema';

export async function audit(
  actorId: string | null,
  action: string,
  subject?: { type: string; id: string },
  meta?: Record<string, unknown>,
  tx: DbOrTx = db,
) {
  await tx.insert(auditLog).values({ actorId, action, subjectType: subject?.type ?? null, subjectId: subject?.id ?? null, meta: meta ?? null });
}
