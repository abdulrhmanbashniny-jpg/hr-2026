import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'mutabaa_session';

/** Optimistic gate: send visitors without a session cookie to sign-in. Pages still verify the session. */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
