import { z } from 'zod';
import { apiPortalUser } from '@/lib/auth/guards';
import { isStaff } from '@/lib/auth/roles';
import { onboard } from '@/lib/craftsmen/service';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { requestFingerprint } from '@/lib/signals';

const Body = z.object({
  displayName: z.string().trim().min(2).max(60),
  cityId: z.string().min(2).max(40),
  trades: z.array(z.string().max(40)).max(8),
  yearsExperience: z.number().int().min(0).max(60),
  district: z.string().trim().max(60).nullable().optional(),
  declaredTier: z.enum(['A', 'B', 'C']).nullable().optional(),
  referralCode: z.string().max(20).nullable().optional(),
  consent: z.literal(true),
  fp: z.string().max(200).nullable().optional(),
});

export const POST = route(async (req) => {
  const s = await apiPortalUser();
  // Staff accounts review invoices and settle rewards; they cannot also earn on the platform.
  if (isStaff(s.user.role)) throw new ApiError('forbidden');
  const body = await readJson(req, Body);
  const created = await onboard(s.user.id, s.user.phone, { ...body, clientFingerprint: body.fp }, await requestFingerprint());
  return ok(created, { status: 201 });
});
