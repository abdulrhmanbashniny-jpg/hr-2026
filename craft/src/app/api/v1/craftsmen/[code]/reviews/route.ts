import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { codeFromParam } from '@/lib/craftsmen/lookup';
import { ok, readJson, route } from '@/lib/http';
import { submitReview } from '@/lib/reviews/service';
import { requestFingerprint } from '@/lib/signals';

type Ctx = { params: Promise<{ code: string }> };

const Body = z.object({
  authorName: z.string().trim().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(600),
  projectLabel: z.string().trim().max(80).nullable().optional(),
});

/** A client's review; published after staff moderation. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const code = codeFromParam((await params).code);
  const input = await readJson(req, Body);
  return ok(await submitReview(code, input, await requestFingerprint()), { status: 201 });
});
