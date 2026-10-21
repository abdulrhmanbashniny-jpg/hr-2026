import type { NextRequest } from 'next/server';
import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, readJson, route } from '@/lib/http';
import { deleteProject, getProject, updateProject } from '@/lib/portfolio/service';
import { ProjectBody } from '@/lib/validation';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  return ok(await getProject(s.craftsman.id, (await params).id), { headers: NO_STORE });
});

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  return ok(await updateProject(s.craftsman.id, s.craftsman.referralCode, (await params).id, await readJson(req, ProjectBody.partial())));
});

export const DELETE = route<Ctx>(async (_req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  await deleteProject(s.craftsman.id, s.craftsman.referralCode, (await params).id);
  return ok({ deleted: true });
});
