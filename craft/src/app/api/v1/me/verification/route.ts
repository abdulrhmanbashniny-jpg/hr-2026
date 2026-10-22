import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { submitVerification } from '@/lib/craftsmen/verification';
import { ok, readJson, route } from '@/lib/http';

const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('national_id'), uploadId: z.uuid(), nationalId: z.string().min(10).max(14) }),
  z.object({ kind: z.literal('freelance_license'), uploadId: z.uuid(), licenseNumber: z.string().trim().min(3).max(40), expiresOn: z.iso.date() }),
]);

export const POST = route(async (req) => {
  const s = await apiCraftsman();
  await submitVerification(s.user.id, s.craftsman.id, await readJson(req, Body));
  return ok({ status: 'pending' });
});
