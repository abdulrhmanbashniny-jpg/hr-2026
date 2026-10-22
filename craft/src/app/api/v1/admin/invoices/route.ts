import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { reviewQueue } from '@/lib/admin/invoices';
import { apiStaff } from '@/lib/auth/guards';
import { NO_STORE, ok, readQuery, route } from '@/lib/http';

const Query = z.object({
  status: z
    .string()
    .optional()
    .transform((v) => (v ? (v.split(',').filter((s) => ['pending', 'flagged', 'approved', 'rejected', 'processing'].includes(s)) as ('pending' | 'flagged' | 'approved' | 'rejected' | 'processing')[]) : undefined)),
  minRisk: z.coerce.number().int().min(0).max(100).optional(),
});

export const GET = route(async (req: NextRequest) => {
  await apiStaff('invoices:review');
  const q = readQuery(req, Query);
  return ok(await reviewQueue({ status: q.status, minRisk: q.minRisk }), { headers: NO_STORE });
});
