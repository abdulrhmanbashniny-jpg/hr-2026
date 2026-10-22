import { apiCraftsman } from '@/lib/auth/guards';
import { requestDeletion } from '@/lib/craftsmen/service';
import { invalidateProfile } from '@/lib/craftsmen/service';
import { ok, route } from '@/lib/http';

export const POST = route(async () => {
  const s = await apiCraftsman();
  await requestDeletion(s.craftsman.id, s.user.id);
  invalidateProfile(s.craftsman.referralCode);
  return ok({ requested: true });
});
