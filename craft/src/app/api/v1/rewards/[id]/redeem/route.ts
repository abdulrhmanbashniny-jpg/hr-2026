import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { redeem } from '@/lib/rewards/service';

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ idempotencyKey: z.string().min(8).max(64), payoutHandle: z.string().max(30).nullable().optional() });

export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  // Points become money here; a number registered with a password alone has not been proven yet.
  if (!s.user.phoneVerified) throw new ApiError('phone_unconfirmed');
  const body = await readJson(req, Body);
  const red = await redeem(s.craftsman.id, s.craftsman.tier, (await params).id, body.idempotencyKey, body.payoutHandle);
  return ok({ id: red.id, status: red.status, pointsSpent: red.pointsSpent }, { status: 201 });
});
