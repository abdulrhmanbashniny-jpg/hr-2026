import { z } from 'zod';
import { requestOtp } from '@/lib/auth/otp';
import { ok, readJson, route } from '@/lib/http';
import { getLocale } from '@/lib/i18n';

const Body = z.object({ phone: z.string().min(9).max(20) });

export const POST = route(async (req) => {
  const { phone } = await readJson(req, Body);
  return ok(await requestOtp(phone, await getLocale()));
});
