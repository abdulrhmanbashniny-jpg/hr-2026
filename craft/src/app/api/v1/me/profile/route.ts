import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { updateProfile } from '@/lib/craftsmen/service';
import { ok, readJson, route } from '@/lib/http';

const Body = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  bio: z.string().max(600).nullable().optional(),
  cityId: z.string().max(40).optional(),
  district: z.string().trim().max(60).nullable().optional(),
  trades: z.array(z.string().max(40)).max(8).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  whatsapp: z.string().max(20).nullable().optional(),
  acceptsCalls: z.boolean().optional(),
  warrantyMonths: z.number().int().min(0).max(120).optional(),
  locale: z.enum(['ar', 'en']).optional(),
});

export const PATCH = route(async (req) => {
  const s = await apiCraftsman();
  await updateProfile(s.craftsman.id, s.user.id, s.craftsman.referralCode, await readJson(req, Body));
  return ok({ saved: true });
});
