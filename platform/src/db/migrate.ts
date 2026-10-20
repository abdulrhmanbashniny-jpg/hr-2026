import './load-env';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, getDb } from './index';

async function main() {
  await migrate(getDb(), { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
  console.log('Migrations applied.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
