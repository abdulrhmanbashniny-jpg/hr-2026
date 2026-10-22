import { eq } from 'drizzle-orm';
import { db, type DbOrTx } from '@/db';
import { appSettings } from '@/db/schema';
import { resolveEconomics, type Economics } from './economics';

export async function getEconomics(tx: DbOrTx = db): Promise<Economics> {
  const [row] = await tx.select().from(appSettings).where(eq(appSettings.key, 'economics'));
  return resolveEconomics(row?.value);
}

export async function saveEconomics(value: Economics, actorId: string) {
  await db
    .insert(appSettings)
    .values({ key: 'economics', value, updatedBy: actorId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
}
