import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __mutabaaPool?: Pool; __mutabaaDb?: Database };

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Missing required environment variable DATABASE_URL');
  return new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  });
}

/** Lazily-created singleton so builds and imports never open a connection by themselves. */
export function getDb(): Database {
  if (!globalForDb.__mutabaaDb) {
    globalForDb.__mutabaaPool = createPool();
    globalForDb.__mutabaaDb = drizzle(globalForDb.__mutabaaPool, { schema });
  }
  return globalForDb.__mutabaaDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export async function closeDb() {
  await globalForDb.__mutabaaPool?.end();
  globalForDb.__mutabaaPool = undefined;
  globalForDb.__mutabaaDb = undefined;
}

export { schema };
