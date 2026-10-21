import { apiCraftsman } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';
import { signUpload } from '@/lib/uploads';
import { SignBody } from '@/lib/validation';

/** Signed direct upload for portfolio photos, thumbnails, posters and videos. */
export const POST = route(async (req) => {
  const s = await apiCraftsman();
  return ok(await signUpload(s.user.id, 'portfolio', await readJson(req, SignBody)));
});
