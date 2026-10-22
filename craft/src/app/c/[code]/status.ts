import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { craftsmen, users } from '@/db/schema';

/**
 * Why a valid member number has no public profile. A suspended membership is worth saying out loud
 * (a client may be holding that card), but it reveals nothing about the person: no name, no photo.
 * A deleted or never-issued number is simply "not found".
 */
export async function memberState(code: string): Promise<'suspended' | 'missing'> {
  const [row] = await db
    .select({ status: users.status, deleting: craftsmen.deletionRequestedAt })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .where(eq(craftsmen.referralCode, code));
  return row && !row.deleting && row.status === 'suspended' ? 'suspended' : 'missing';
}
