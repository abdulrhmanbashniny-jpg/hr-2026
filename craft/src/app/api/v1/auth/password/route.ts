import { z } from 'zod';
import { PASSWORD_PAGE } from '@/lib/auth/guards';
import { loginWithPassword } from '@/lib/auth/password-login';
import { PASSWORD_MAX } from '@/lib/auth/password';
import { isStaff } from '@/lib/auth/roles';
import { getSession } from '@/lib/auth/session';
import { ok, readJson, route } from '@/lib/http';
import { safeNext } from '@/lib/safe-next';

// Length is bounded here too: hashing an unbounded string would be a cheap way to burn CPU.
const Body = z.object({ phone: z.string().min(9).max(20), password: z.string().min(1).max(PASSWORD_MAX * 4), next: z.string().max(300).optional() });

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  const { userId, role, mustChangePassword } = await loginWithPassword(body.phone, body.password);
  const s = await getSession();
  const target = isStaff(role) ? safeNext(body.next, '/admin') : s?.craftsman ? safeNext(body.next, '/app') : '/app/onboarding';
  const next = mustChangePassword ? `${PASSWORD_PAGE}?next=${encodeURIComponent(target)}` : target;
  return ok({ userId, role, next });
});
