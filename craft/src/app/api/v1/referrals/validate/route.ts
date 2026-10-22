import { z } from 'zod';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { getSession } from '@/lib/auth/session';
import { validateReferralCode } from '@/lib/craftsmen/service';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { requestFingerprint } from '@/lib/signals';

const Body = z.object({ code: z.string().max(20) });

export const POST = route(async (req) => {
  const { code } = await readJson(req, Body);
  const fp = await requestFingerprint();
  if (!(await consume([{ key: `refcheck:${fp.ipHash ?? 'anon'}`, limit: 60, windowMs: HOUR }]))) throw new ApiError('rate_limited');
  const s = await getSession();
  const { ref, city } = await validateReferralCode(code, s?.user.id);
  return ok({ valid: true, referrer: { code: ref.referralCode, displayName: ref.displayName, tier: ref.tier, city } });
});
