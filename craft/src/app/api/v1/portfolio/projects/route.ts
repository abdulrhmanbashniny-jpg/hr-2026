import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, readJson, route } from '@/lib/http';
import { createProject, listProjects } from '@/lib/portfolio/service';
import { ProjectBody } from '@/lib/validation';

export const GET = route(async () => {
  const s = await apiCraftsman();
  return ok(await listProjects(s.craftsman.id), { headers: NO_STORE });
});

export const POST = route(async (req) => {
  const s = await apiCraftsman();
  return ok(await createProject(s.craftsman.id, s.craftsman.referralCode, await readJson(req, ProjectBody)), { status: 201 });
});
