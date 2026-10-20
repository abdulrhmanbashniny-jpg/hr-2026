'use server';

import { and, count, eq, gt } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { db } from '@/db';
import { contactMessages } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { runAction, str } from '@/lib/actions';
import { clientIp, getSession } from '@/lib/auth/session';
import { cleanContactPhone, isContactCategory, notifyContactMessage } from '@/lib/contact';
import { sha256 } from '@/lib/crypto';
import { getI18n } from '@/lib/i18n';

const PER_HOUR = 5;

/** The public "Contact us" form: stores the message and alerts the platform team. */
export async function submitContact(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { t } = await getI18n();
    const c = t.contact;
    // Bots fill every field, people never see this one.
    if (str(form, 'website')) return { ok: true };

    const name = str(form, 'name').slice(0, 80);
    const phone = cleanContactPhone(str(form, 'phone'));
    const category = str(form, 'category');
    const message = str(form, 'message').slice(0, 4000);
    if (name.length < 2) return { ok: false, error: c.invalidName };
    if (!phone) return { ok: false, error: c.invalidPhone };
    if (!isContactCategory(category)) return { ok: false, error: `${c.category}: ${t.common.required}` };
    if (message.length < 10) return { ok: false, error: c.tooShort };

    const ip = await clientIp();
    const ipHash = ip ? sha256(`contact:${ip}`) : null;
    if (ipHash) {
      const [{ n }] = await db
        .select({ n: count() })
        .from(contactMessages)
        .where(and(eq(contactMessages.ipHash, ipHash), gt(contactMessages.createdAt, new Date(Date.now() - 3600_000))));
      if (n >= PER_HOUR) return { ok: false, error: c.tooMany };
    }

    const s = await getSession();
    await db.insert(contactMessages).values({ name, phone, category, message, userId: s?.user.id ?? null, tenantId: s?.tenant?.id ?? null, ipHash });
    after(() =>
      notifyContactMessage({ name, phone, category, message, tenantName: s?.tenant?.name ?? null, email: s?.user.email ?? null }).catch((err) => console.error('contact alert failed', err)),
    );
    revalidatePath('/admin', 'layout');
    return { ok: true, message: c.sent };
  });
}
