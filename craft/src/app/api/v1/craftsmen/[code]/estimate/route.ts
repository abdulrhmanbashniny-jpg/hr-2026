import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { craftsmen, users } from '@/db/schema';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { codeFromParam } from '@/lib/craftsmen/lookup';
import { recordLead } from '@/lib/craftsmen/service';
import { env } from '@/lib/env';
import { estimatePaint } from '@/lib/estimator';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { dictionary, f, getLocale } from '@/lib/i18n';
import { requestFingerprint } from '@/lib/signals';
import { whatsappLink } from '@/lib/whatsapp';

type Ctx = { params: Promise<{ code: string }> };

const Body = z.object({
  areaSqm: z.number().positive().max(100_000).optional(),
  room: z.object({ length: z.number().positive().max(200), width: z.number().positive().max(200), height: z.number().positive().max(30), includeCeiling: z.boolean() }).optional(),
  openingsSqm: z.number().min(0).max(10_000).optional(),
  coats: z.number().int().min(1).max(4),
  kind: z.enum(['interior', 'exterior', 'enamel']),
  primer: z.boolean(),
});

/** The client's estimate goes to the craftsman on WhatsApp and counts as a qualified lead. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const code = codeFromParam((await params).code);
  const input = await readJson(req, Body);
  if (!input.areaSqm && !input.room) throw new ApiError('validation');
  const fp = await requestFingerprint();
  if (!(await consume([{ key: `estimate:${fp.ipHash ?? 'anon'}`, limit: 20, windowMs: HOUR }]))) throw new ApiError('rate_limited');
  const [c] = await db
    .select({ id: craftsmen.id, name: craftsmen.displayName, whatsapp: craftsmen.whatsapp, phone: users.phone, status: users.status })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .where(eq(craftsmen.referralCode, code));
  if (!c || c.status !== 'active') throw new ApiError('not_found');
  const estimate = estimatePaint(input);
  const t = dictionary(await getLocale());
  const text = f(t.estimator.message, { name: c.name, code, area: estimate.paintableSqm, coats: input.coats, kind: t.estimator.kinds[input.kind], liters: estimate.liters, url: `${env.appUrl}/c/${code}` });
  await recordLead(c.id, 'estimate', 'direct', fp.ipHash, { sqm: estimate.paintableSqm, liters: estimate.liters, kind: input.kind });
  return ok({ estimate, whatsappUrl: whatsappLink(c.whatsapp ?? c.phone, text) });
});
