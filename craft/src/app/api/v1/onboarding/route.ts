import { z } from 'zod';
import { apiUser } from '@/lib/auth/guards';
import { onboard } from '@/lib/craftsmen/service';
import { ok, readJson, route } from '@/lib/http';
import { requestFingerprint } from '@/lib/signals';

const Body = z.object({
  displayName: z.string().trim().min(2).max(60),
  cityId: z.string().min(2).max(40),
  trades: z.array(z.string().max(40)).max(8),
  yearsExperience: z.number().int().min(0).max(60),
  referralCode: z.string().max(20).nullable().optional(),
  consent: z.literal(true),
  fp: z.string().max(200).nullable().optional(),
});

export const POST = route(async (req) => {
  const s = await apiUser();
  const body = await readJson(req, Body);
  const created = await onboard(s.user.id, s.user.phone, { ...body, clientFingerprint: body.fp }, await requestFingerprint());
  return ok(created, { status: 201 });
});
