import { and, eq } from 'drizzle-orm';
import { after, type NextRequest } from 'next/server';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { apiCraftsman } from '@/lib/auth/guards';
import { ApiError, NO_STORE, ok, route } from '@/lib/http';
import { processInvoice } from '@/lib/invoices/pipeline';
import { publicInvoice } from '@/lib/invoices/queries';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const s = await apiCraftsman();
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, (await params).id), eq(invoices.craftsmanId, s.craftsman.id)));
  if (!inv) throw new ApiError('not_found');
  // Self-healing: if the background step died (deploy, crash), polling restarts it.
  if (inv.status === 'processing' && Date.now() - inv.createdAt.getTime() > 90_000) after(() => processInvoice(inv.id));
  return ok(publicInvoice(inv), { headers: NO_STORE });
});
