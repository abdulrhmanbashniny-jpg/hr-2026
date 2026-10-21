import './load-env';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, getDb } from './index';

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  // Defence in depth on hosted Postgres: row-level security on every table this role owns. The app
  // connects as the owner, which RLS does not restrict; any other role (such as a hosting
  // provider's public API roles) sees no rows even if it is granted access by mistake.
  await db.execute(sql`
    DO $$
    DECLARE t record;
    BEGIN
      FOR t IN
        SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity AND pg_get_userbyid(c.relowner) = current_user
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
      END LOOP;
    END $$;
  `);
  console.log('Migrations applied.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
