import { eq, inArray } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '@/db';
import { notifications, pushSubscriptions, users } from '@/db/schema';
import { env } from '@/lib/env';
import { dictionary, f } from '@/lib/i18n';
import type { Dictionary } from '@/lib/i18n/ar';

export type NotificationKind = keyof Dictionary['notifications']['kinds'];

export function pushConfigured(): boolean {
  return !!(env.push.publicKey && env.push.privateKey);
}

let vapidSet = false;
function ensureVapid() {
  if (!vapidSet) {
    webpush.setVapidDetails(env.push.subject, env.push.publicKey, env.push.privateKey);
    vapidSet = true;
  }
}

/** Sends a Web Push to every device of a user; endpoints the push service no longer knows are removed. */
export async function pushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured()) return;
  ensureVapid();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86_400, urgency: 'normal' });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
        else console.warn('[push] delivery failed', status);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
}

type Vars = Record<string, string | number>;

/** In-app notification in the user's language, mirrored to Web Push. Never throws. */
export async function notify(userId: string, kind: NotificationKind, vars: Vars | ((t: Dictionary) => Vars) = {}, url?: string) {
  try {
    const [u] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    const t = dictionary(u?.locale === 'en' ? 'en' : 'ar');
    const tpl = t.notifications.kinds[kind];
    if (typeof vars === 'function') vars = vars(t);
    const title = f(tpl.title, vars);
    const body = f(tpl.body, vars);
    await db.insert(notifications).values({ userId, kind, title, body, url: url ?? null });
    await pushToUser(userId, { title, body, url, tag: kind });
  } catch (err) {
    console.error('[notify]', kind, err);
  }
}
