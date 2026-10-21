/** Keeps the redirect after sign-in on this site: only a same-origin path is accepted. */
export function safeNext(next: string, appUrl: string): string {
  // Backslashes and control characters are normalised by browsers into other hosts (/\evil.com).
  if (!next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) return '/app';
  try {
    const base = new URL(appUrl);
    const url = new URL(next, base);
    return url.origin === base.origin ? `${url.pathname}${url.search}${url.hash}` : '/app';
  } catch {
    return '/app';
  }
}
