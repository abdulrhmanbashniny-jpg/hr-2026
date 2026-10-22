import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { removeAvatar, setAvatar } from '@/lib/craftsmen/avatar';
import { ok, readJson, route } from '@/lib/http';

const Body = z.object({ uploadId: z.uuid() });

/** Attach an uploaded photo (purpose "avatar") to the member card and public profile. */
export const PUT = route(async (req) => {
  const s = await apiCraftsman();
  const { uploadId } = await readJson(req, Body);
  return ok(await setAvatar(s.user.id, s.craftsman.id, s.craftsman.referralCode, uploadId));
});

export const DELETE = route(async () => {
  const s = await apiCraftsman();
  await removeAvatar(s.craftsman.id);
  return ok({ avatarUrl: null });
});
