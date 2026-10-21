import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { setAvailability } from '@/lib/craftsmen/service';
import { ok, readJson, route } from '@/lib/http';

const Body = z.object({ availability: z.enum(['available', 'busy', 'away']), until: z.iso.datetime({ offset: true }).nullable().optional() });

export const PATCH = route(async (req) => {
  const s = await apiCraftsman();
  const body = await readJson(req, Body);
  await setAvailability(s.craftsman.id, s.craftsman.referralCode, body.availability, body.until ? new Date(body.until) : null);
  return ok({ availability: body.availability });
});
