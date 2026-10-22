import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { apiPortalUser } from '@/lib/auth/guards';
import { staffCan } from '@/lib/auth/roles';
import { ApiError, route } from '@/lib/http';
import { storage } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

/** Invoice photos are private: the owner and reviewers only, never cached. */
export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const s = await apiPortalUser();
  const [inv] = await db.select({ key: invoices.imageKey, craftsmanId: invoices.craftsmanId }).from(invoices).where(eq(invoices.id, (await params).id));
  if (!inv) throw new ApiError('not_found');
  if (inv.craftsmanId !== s.craftsman?.id && !staffCan(s.user.role, 'invoices:review')) throw new ApiError('forbidden');
  const file = await storage().get(inv.key);
  if (!file) throw new ApiError('not_found');
  return new NextResponse(new Uint8Array(file.body), { headers: { 'content-type': file.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
});
