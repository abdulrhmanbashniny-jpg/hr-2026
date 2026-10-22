import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { rateLimitHits, sessions, users } from '@/db/schema';
import { audit } from '@/lib/audit';
import { sha256 } from '@/lib/crypto';
import { hashPassword, temporaryPassword } from './password';

/** Rate-limit key for failed password guesses on a number, from any requester. */
export const failureKey = (phone: string) => `pw:fail:${phone}`;

/**
 * Sets a one-time password, signs the user out everywhere and clears the failed-guess count on the
 * number, so a user locked out by someone else's guessing can sign in again. Used by staff from the
 * console and by the owner's recovery script (no staff actor). No Next.js imports: scripts load it.
 */
export async function issueTemporaryPassword(userId: string, actorId: string | null): Promise<string> {
  const temp = temporaryPassword();
  const passwordHash = await hashPassword(temp);
  await db.transaction(async (tx) => {
    const [u] = await tx.update(users).set({ passwordHash, passwordChangedAt: new Date(), mustChangePassword: true }).where(eq(users.id, userId)).returning({ phone: users.phone });
    // Callers check the user exists first; this only guards a row deleted in between.
    if (!u) throw new Error('User not found');
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    await tx.delete(rateLimitHits).where(eq(rateLimitHits.key, sha256(failureKey(u.phone))));
    await audit(actorId, 'auth.password_reset', { type: 'user', id: userId }, undefined, tx);
  });
  return temp;
}
