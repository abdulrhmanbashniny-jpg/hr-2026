import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, route } from '@/lib/http';
import { myRedemptions } from '@/lib/rewards/service';

export const GET = route(async () => {
  const s = await apiCraftsman();
  return ok(await myRedemptions(s.craftsman.id), { headers: NO_STORE });
});
