import { eq } from 'drizzle-orm';
import { z } from 'zod';
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

// ───────────────────────── Telegram alerts for the platform team ─────────────────────────

export const platformTelegramSchema = z.object({
  enabled: z.boolean(),
  botTokenEnc: z.string().nullable(),
  botUsername: z.string(),
  chatIds: z.array(z.string().regex(/^-?\d{4,20}$/)).max(20),
});
export type PlatformTelegram = z.infer<typeof platformTelegramSchema>;

const TELEGRAM_KEY = 'telegram_alerts';

export async function getPlatformTelegram(): Promise<PlatformTelegram | null> {
  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, TELEGRAM_KEY));
    const parsed = row ? platformTelegramSchema.safeParse(row.value) : null;
    return parsed?.success ? parsed.data : null;
  } catch (err) {
    console.error('platform settings unavailable', err);
    return null;
  }
}

export async function savePlatformTelegram(value: PlatformTelegram, userId: string): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key: TELEGRAM_KEY, value, updatedBy: userId })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: userId, updatedAt: new Date() } });
}
