import './load-env';
import { sql } from 'drizzle-orm';
import { hashPassword, temporaryPassword } from '@/lib/auth/password';
import { normalizeSaudiMobile } from '@/lib/phone';
import { closeDb, getDb } from './index';
import { appSettings, auditLog, users } from './schema';

/**
 * Takes the platform from demo to real use, once:
 *   LAUNCH_ADMIN_PHONE=05XXXXXXXX npm run db:launch -- --confirm
 *
 * Deletes every account, card, invoice, point, referral, review, product, reward, dealer, file and
 * log, and keeps only the reference data (regions, cities, trades, the factory brand row) and the
 * points economics and factory profile settings. Creates the owner's super-admin account with a
 * temporary password, printed once, to be replaced at the first sign-in. Leaves a marker so this
 * never runs again and the demo seed never refills a live database.
 */

/** Kept as they are. Everything else in the public schema is emptied. */
const KEEP_TABLES = new Set(['regions', 'cities', 'trades', 'brands', 'app_settings']);
const KEEP_SETTINGS = ['economics', 'brand'];
export const LAUNCH_MARKER = 'launch';

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('This deletes all demo and user data. Re-run with --confirm.');
    process.exitCode = 2;
    return;
  }
  const phone = normalizeSaudiMobile(process.env.LAUNCH_ADMIN_PHONE ?? '');
  if (!phone) {
    console.error('Set LAUNCH_ADMIN_PHONE to the owner’s Saudi mobile number (05XXXXXXXX).');
    process.exitCode = 2;
    return;
  }

  const db = getDb();
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);

  const wiped = await db.transaction(async (tx) => {
    // One launch per database: a second run would delete real members.
    await tx.execute(sql`LOCK TABLE ${appSettings} IN EXCLUSIVE MODE`);
    const done = await tx.execute(sql`SELECT 1 FROM ${appSettings} WHERE key = ${LAUNCH_MARKER}`);
    if (done.rows.length) throw new Error('This database was already launched. Nothing was changed.');

    const { rows } = await tx.execute<{ name: string }>(sql`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    const wipe = rows.map((r) => r.name).filter((n) => !KEEP_TABLES.has(n) && n !== 'users');

    // Settings point at the user who last saved them; that link goes before the users do.
    await tx.update(appSettings).set({ updatedBy: null });
    // One statement, without CASCADE: if a kept table ever referenced one of these, Postgres refuses
    // instead of silently emptying the kept table too.
    if (wipe.length) await tx.execute(sql.raw(`TRUNCATE TABLE ${wipe.map((n) => `"${n}"`).join(', ')} RESTART IDENTITY`));
    await tx.delete(users);
    await tx.execute(sql`DELETE FROM ${appSettings} WHERE key NOT IN (${sql.join(KEEP_SETTINGS.map((k) => sql`${k}`), sql`, `)})`);

    const [owner] = await tx
      .insert(users)
      .values({ phone, name: 'مدير المنصة', role: 'super_admin', passwordHash, passwordChangedAt: new Date(), mustChangePassword: true, phoneVerifiedAt: new Date() })
      .returning({ id: users.id });
    await tx.insert(appSettings).values({ key: LAUNCH_MARKER, value: { launchedAt: new Date().toISOString(), adminPhone: phone }, updatedBy: owner.id });
    await tx.insert(auditLog).values({ actorId: owner.id, action: 'platform.launch', subjectType: 'user', subjectId: owner.id, meta: { tablesEmptied: wipe.length + 1 } });
    return wipe.length + 1;
  });

  console.log(`Launched. ${wiped} tables emptied; regions, cities, trades, the brand and the settings kept.`);
  console.log(`Super admin: ${phone}`);
  console.log(`Temporary password (shown once, must be changed at first sign-in): ${password}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
