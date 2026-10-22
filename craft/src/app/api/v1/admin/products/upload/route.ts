import { apiStaff } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';
import { signUpload } from '@/lib/uploads';
import { SignBody } from '@/lib/validation';

/** Signed direct upload for a product photo (console). */
export const POST = route(async (req) => {
  const s = await apiStaff('products:manage');
  return ok(await signUpload(s.user.id, 'product', await readJson(req, SignBody)));
});
