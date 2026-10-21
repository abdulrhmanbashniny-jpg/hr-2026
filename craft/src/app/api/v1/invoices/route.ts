import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, readJson, readQuery, route } from '@/lib/http';
import { processInvoice, submitInvoice } from '@/lib/invoices/pipeline';
import { listInvoices } from '@/lib/invoices/queries';
import { requestFingerprint } from '@/lib/signals';

const Body = z.object({
  uploadId: z.uuid(),
  qrPayload: z.string().max(2000).nullable().optional(),
  declaredAmount: z.number().positive().max(10_000_000).nullable().optional(),
  fp: z.string().max(200).nullable().optional(),
});

export const GET = route(async (req: NextRequest) => {
  const s = await apiCraftsman();
  const q = readQuery(req, z.object({ cursor: z.iso.datetime({ offset: true }).optional() }));
  return ok(await listInvoices(s.craftsman.id, q.cursor ?? null), { headers: NO_STORE });
});

/** Accepts the claim, answers 202 at once, and reads and scores the invoice after the response. */
export const POST = route(async (req: NextRequest) => {
  const s = await apiCraftsman();
  const body = await readJson(req, Body);
  const res = await submitInvoice(s.user.id, s.craftsman.id, { ...body, clientFingerprint: body.fp }, await requestFingerprint());
  after(() => processInvoice(res.id));
  return ok(res, { status: 202 });
});
