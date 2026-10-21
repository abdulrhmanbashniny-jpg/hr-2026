import type { NextRequest } from 'next/server';
import { getPublicProfile } from '@/lib/craftsmen/public';
import { codeFromParam } from '@/lib/craftsmen/lookup';
import { ApiError, ok, route } from '@/lib/http';

type Ctx = { params: Promise<{ code: string }> };

/** Public profile. Cached at the edge for a minute and served stale for ten while it refreshes. */
export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const code = codeFromParam((await params).code);
  const profile = await getPublicProfile(code);
  if (!profile) throw new ApiError('not_found');
  return ok(profile, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } });
});
