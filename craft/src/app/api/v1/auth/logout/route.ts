import { destroySession } from '@/lib/auth/session';
import { ok, route } from '@/lib/http';

export const POST = route(async () => {
  await destroySession();
  return ok({ signedOut: true });
});
