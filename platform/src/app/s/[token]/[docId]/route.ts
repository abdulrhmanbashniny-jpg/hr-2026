import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { shareLinks } from '@/db/schema';
import { readDocumentFile, resolveShareToken } from '@/lib/documents/share';
import { contentDisposition as disposition } from '@/lib/http';

export const runtime = 'nodejs';

/** Public download through a time-limited share link. */
export async function GET(_req: Request, ctx: RouteContext<'/s/[token]/[docId]'>) {
  const { token, docId } = await ctx.params;
  const resolved = await resolveShareToken(token);
  const doc = resolved?.docs.find((d) => d.id === docId);
  if (!resolved || !doc) return new NextResponse('Link expired or invalid', { status: 404 });
  if (!doc.fileKey) {
    if (doc.externalUrl) return NextResponse.redirect(doc.externalUrl);
    return new NextResponse('Not found', { status: 404 });
  }
  const file = await readDocumentFile(doc);
  if (!file) return new NextResponse('Not found', { status: 404 });
  await db
    .update(shareLinks)
    .set({ accessCount: sql`${shareLinks.accessCount} + 1`, lastAccessedAt: new Date() })
    .where(eq(shareLinks.id, resolved.link.id));
  return new NextResponse(file.bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': disposition(file.name, file.mime),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
