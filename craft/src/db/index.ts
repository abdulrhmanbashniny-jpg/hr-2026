import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
/** A transaction handle; services accept either so they compose inside a caller's transaction. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DbOrTx = Database | Tx;

const globalForDb = globalThis as unknown as { __hirfaPool?: Pool; __hirfaDb?: Database };

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
  if (!globalForDb.__hirfaDb) {
    globalForDb.__hirfaPool = createPool();
    globalForDb.__hirfaDb = drizzle(globalForDb.__hirfaPool, { schema });
  }
  return globalForDb.__hirfaDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export async function closeDb() {
  await globalForDb.__hirfaPool?.end();
  globalForDb.__hirfaPool = undefined;
  globalForDb.__hirfaDb = undefined;
}

export { schema };
