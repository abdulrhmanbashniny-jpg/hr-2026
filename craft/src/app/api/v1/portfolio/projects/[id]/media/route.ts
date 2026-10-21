import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { ok, readJson, route } from '@/lib/http';
import { addMedia } from '@/lib/portfolio/service';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  uploadId: z.uuid(),
  thumbUploadId: z.uuid().nullable().optional(),
  posterUploadId: z.uuid().nullable().optional(),
  role: z.enum(['before', 'after', 'gallery']),
  width: z.number().int().positive().max(20_000).nullable().optional(),
  height: z.number().int().positive().max(20_000).nullable().optional(),
  durationSec: z.number().positive().max(600).nullable().optional(),
  lqip: z.string().max(4000).nullable().optional(),
  capturedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  geo: z.object({ lat: z.number().min(15).max(33), lng: z.number().min(34).max(56) }).nullable().optional(),
});

export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  return ok(await addMedia(s.user.id, s.craftsman.id, s.craftsman.referralCode, (await params).id, await readJson(req, Body)), { status: 201 });
});
