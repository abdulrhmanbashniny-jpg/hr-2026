import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, route } from '@/lib/http';
import { catalog } from '@/lib/rewards/service';

export const GET = route(async () => {
  const s = await apiCraftsman();
  return ok(await catalog(s.craftsman.id, s.craftsman.tier), { headers: NO_STORE });
});
