import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'hirfa_session';
const DEVICE_COOKIE = 'hirfa_did';
const REF_COOKIE = 'hirfa_ref';

/**
 * Content-Security-Policy with a fresh nonce per request: only scripts carrying the nonce (Next.js
 * adds it to its own) may run. Object storage origins are allowed for direct uploads and media.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const storage = [process.env.S3_ENDPOINT, process.env.MEDIA_PUBLIC_BASE_URL].filter(Boolean).map((u) => new URL(u!).origin);
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src 'self' data: blob: ${storage.join(' ')}`.trim(),
    `media-src 'self' blob: ${storage.join(' ')}`.trim(),
    `connect-src 'self' ${storage.join(' ')}`.trim(),
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

function deviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (!isApi && (pathname.startsWith('/app') || pathname.startsWith('/admin')) && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // A first-party random id per browser: one of the fraud signals (shared devices across accounts).
  const newDevice = request.cookies.has(DEVICE_COOKIE) ? null : deviceId();
  const ref = !isApi && pathname === '/join' ? searchParams.get('ref') : null;

  let response: NextResponse;
  if (isApi) {
    const headers = new Headers(request.headers);
    if (newDevice) headers.set('cookie', `${request.headers.get('cookie') ?? ''}; ${DEVICE_COOKIE}=${newDevice}`);
    response = NextResponse.next({ request: { headers } });
  } else {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = contentSecurityPolicy(nonce);
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    response = NextResponse.next({ request: { headers } });
    response.headers.set('Content-Security-Policy', csp);
  }
  const secure = process.env.NODE_ENV === 'production';
  if (newDevice) response.cookies.set(DEVICE_COOKIE, newDevice, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 400 * 86_400 });
  if (ref && /^\d{6,7}$/.test(ref)) response.cookies.set(REF_COOKIE, ref, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 30 * 86_400 });
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons/|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|og.png).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
