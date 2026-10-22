import { z } from 'zod';
import { registerWithPassword } from '@/lib/auth/password-login';
import { PASSWORD_MAX } from '@/lib/auth/password';
import { ok, readJson, route } from '@/lib/http';

const Body = z.object({ phone: z.string().min(9).max(20), password: z.string().min(1).max(PASSWORD_MAX * 4) });

export const POST = route(async (req) => {
  const { phone, password } = await readJson(req, Body);
  const { userId } = await registerWithPassword(phone, password);
  return ok({ userId, next: '/app/onboarding' }, { status: 201 });
});
