import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';
import { deleteMedia, setMediaRole } from '@/lib/portfolio/service';

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  const { role } = await readJson(req, z.object({ role: z.enum(['before', 'after', 'gallery']) }));
  await setMediaRole(s.craftsman.id, s.craftsman.referralCode, (await params).id, role);
  return ok({ role });
});

export const DELETE = route<Ctx>(async (_req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  await deleteMedia(s.craftsman.id, s.craftsman.referralCode, (await params).id);
  return ok({ deleted: true });
});
