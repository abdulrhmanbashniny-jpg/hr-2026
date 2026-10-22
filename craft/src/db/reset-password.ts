import './load-env';
import { eq } from 'drizzle-orm';
import { issueTemporaryPassword } from '@/lib/auth/temporary';
import { normalizeSaudiMobile } from '@/lib/phone';
import { closeDb, getDb } from './index';
import { users } from './schema';

/**
 * Recovery when nobody can reach the console (the owner forgot the password, or the launch output
 * was lost): issues a one-time password for any account, staff included, without touching data.
 *   RESET_PHONE=05XXXXXXXX npm run db:reset-password -- --confirm
 */
async function main() {
  const phone = normalizeSaudiMobile(process.env.RESET_PHONE ?? '');
  if (!phone || !process.argv.includes('--confirm')) {
    console.error('Usage: RESET_PHONE=05XXXXXXXX npm run db:reset-password -- --confirm');
    process.exitCode = 2;
    return;
  }
  const [user] = await getDb().select({ id: users.id, role: users.role }).from(users).where(eq(users.phone, phone));
  if (!user) {
    console.error(`No account uses ${phone}.`);
    process.exitCode = 1;
    return;
  }
  const password = await issueTemporaryPassword(user.id, null);
  console.log(`${phone} (${user.role}): every session signed out.`);
  console.log(`Temporary password (shown once, valid 7 days, must be changed at sign-in): ${password}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
