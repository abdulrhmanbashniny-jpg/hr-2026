import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, route } from '@/lib/http';
import { referralNetwork } from '@/lib/referrals/service';

export const GET = route(async () => {
  const s = await apiCraftsman();
  return ok(await referralNetwork(s.craftsman.id), { headers: NO_STORE });
});
