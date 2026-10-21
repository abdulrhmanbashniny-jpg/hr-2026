import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, route } from '@/lib/http';
import { storage } from '@/lib/storage';

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * Public portfolio media and avatars. Keys are random and never reused, so responses are immutable.
 * Invoices and identity documents live under other prefixes and are never served here.
 */
export const GET = route<Ctx>(
  async (req: NextRequest, { params }) => {
    const key = (await params).key.join('/');
    if (!/^(portfolio|avatar)\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{24}\.[a-z0-9]{2,5}$/.test(key)) throw new ApiError('not_found');
    const driver = storage();
    if (driver.presignGet) return NextResponse.redirect(await driver.presignGet(key, 3600), { status: 302, headers: { 'Cache-Control': 'public, max-age=3000' } });
    const file = await driver.get(key);
    if (!file) throw new ApiError('not_found');
    const range = req.headers.get('range');
    const headers: Record<string, string> = { 'content-type': file.mime, 'cache-control': 'public, max-age=31536000, immutable', 'accept-ranges': 'bytes', 'x-content-type-options': 'nosniff' };
    // Safari plays video only from servers that honour byte ranges.
    const m = range?.match(/^bytes=(\d*)-(\d*)$/);
    if (m && (m[1] || m[2])) {
      const size = file.body.length;
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start >= size || start > end) return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
      return new NextResponse(new Uint8Array(file.body.subarray(start, end + 1)), { status: 206, headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
    }
    return new NextResponse(new Uint8Array(file.body), { headers: { ...headers, 'content-length': String(file.body.length) } });
  },
  { csrf: false },
);
