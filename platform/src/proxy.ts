import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'mutabaa_session';

/**
 * Content-Security-Policy with a fresh nonce per request. Only scripts carrying the nonce (Next.js
 * adds it to its own scripts; the layout adds it to the theme script) and the scripts they load may
 * run, so injected markup cannot execute JavaScript. Styles allow inline attributes, which the UI
 * uses throughout; fonts come from Google Fonts.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Optimistic gate: send visitors without a session cookie to sign-in. Pages still verify the session.
  if ((pathname.startsWith('/app') || pathname.startsWith('/admin')) && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not static assets, image optimisation, API routes or metadata files.
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg|og.png|robots.txt|sitemap.xml|llms.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
