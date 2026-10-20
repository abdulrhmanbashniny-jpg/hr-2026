import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { readDocumentFile } from '@/lib/documents/share';
import { contentDisposition as disposition } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: RouteContext<'/api/documents/[id]/file'>) {
  const { id } = await ctx.params;
  const s = await getSession();
  if (!s?.tenant || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.tenantId, s.tenant.id)));
  if (!doc) return new NextResponse('Not found', { status: 404 });
  const file = await readDocumentFile(doc);
  if (!file) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(file.bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': disposition(file.name, file.mime),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

