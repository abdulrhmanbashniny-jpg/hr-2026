import { z } from 'zod';
import { apiUser } from '@/lib/auth/guards';
import { changePassword } from '@/lib/auth/password-login';
import { PASSWORD_MAX } from '@/lib/auth/password';
import { isStaff } from '@/lib/auth/roles';
import { ok, readJson, route } from '@/lib/http';
import { safeNext } from '@/lib/safe-next';

const Body = z.object({
  current: z.string().max(PASSWORD_MAX * 4).optional(),
  password: z.string().min(1).max(PASSWORD_MAX * 4),
  next: z.string().max(300).optional(),
});

/** Works while a temporary password is still in force: this is the one place it must work. */
export const POST = route(async (req) => {
  const s = await apiUser();
  const body = await readJson(req, Body);
  await changePassword(s.user.id, s.sessionId, body.current, body.password);
  const fallback = isStaff(s.user.role) ? '/admin' : s.craftsman ? '/app' : '/app/onboarding';
  return ok({ next: safeNext(body.next, fallback) });
});
