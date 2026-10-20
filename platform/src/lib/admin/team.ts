import { and, count, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { staffRoleOf } from './staff';

/** True when an active platform owner other than `userId` remains. */
export async function anotherOwner(userId: string): Promise<boolean> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.isSuperAdmin, true), ne(users.id, userId), isNull(users.disabledAt), or(eq(users.staffRole, 'owner'), isNull(users.staffRole))));
  return n > 0;
}

/** Losing `userId` as an owner would leave the console with no owner at all. */
export async function isLastOwner(userId: string): Promise<boolean> {
  const [user] = await db.select({ isSuperAdmin: users.isSuperAdmin, staffRole: users.staffRole }).from(users).where(eq(users.id, userId));
  if (!user || staffRoleOf(user) !== 'owner') return false;
  return !(await anotherOwner(userId));
}
