import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { verificationDocuments } from '@/db/schema';
import { audit } from '@/lib/audit';
import { apiStaff } from '@/lib/auth/guards';
import { ApiError, route } from '@/lib/http';
import { storage } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };

/** Identity and licence documents: staff only, never cached, and every view is audit-logged. */
export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const s = await apiStaff('craftsmen:manage');
  const id = (await params).id;
  const [doc] = await db.select().from(verificationDocuments).where(eq(verificationDocuments.id, id));
  if (!doc) throw new ApiError('not_found');
  const file = await storage().get(doc.storageKey);
  if (!file) throw new ApiError('not_found');
  await audit(s.user.id, 'document.view', { type: 'verification_document', id });
  return new NextResponse(new Uint8Array(file.body), { headers: { 'content-type': file.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
});
