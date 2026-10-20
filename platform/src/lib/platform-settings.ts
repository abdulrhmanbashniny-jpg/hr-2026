import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '@/db';
import { platformSettings } from '@/db/schema';
import { smtpSchema } from '@/lib/settings';

export type PlatformSmtp = z.infer<typeof smtpSchema>;

const SMTP_KEY = 'smtp';
const TTL_MS = 30_000;
let cached: { at: number; value: PlatformSmtp | null } | null = null;

/** The platform mail server saved from the console (cached briefly; null when none is saved). */
export async function getPlatformSmtp(): Promise<PlatformSmtp | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value: PlatformSmtp | null = null;
  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, SMTP_KEY));
    const parsed = row ? smtpSchema.safeParse(row.value) : null;
    value = parsed?.success ? parsed.data : null;
  } catch (err) {
    console.error('platform settings unavailable', err);
  }
  cached = { at: Date.now(), value };
  return value;
}

export async function savePlatformSmtp(value: PlatformSmtp, userId: string): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key: SMTP_KEY, value, updatedBy: userId })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: userId, updatedAt: new Date() } });
  cached = null;
}
