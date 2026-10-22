import { apiCraftsman } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';
import { signUpload } from '@/lib/uploads';
import { SignBody } from '@/lib/validation';

export const POST = route(async (req) => {
  const s = await apiCraftsman();
  return ok(await signUpload(s.user.id, 'invoice', await readJson(req, SignBody)));
});
