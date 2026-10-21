import { z } from 'zod';
import { verifyOtp } from '@/lib/auth/otp';
import { isStaff } from '@/lib/auth/roles';
import { getSession } from '@/lib/auth/session';
import { ok, readJson, route } from '@/lib/http';
import { safeNext } from '@/lib/safe-next';

const Body = z.object({ challengeId: z.uuid(), code: z.string().min(4).max(12), next: z.string().max(300).optional() });

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { userId, role } = await verifyOtp(body.challengeId, body.code);
  const s = await getSession();
  const hasCard = !!s?.craftsman;
  const next = isStaff(role) ? safeNext(body.next, '/admin') : hasCard ? safeNext(body.next, '/app') : '/app/onboarding';
  return ok({ userId, role, next });
});
