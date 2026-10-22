const BASE = 'https://same-site.invalid';

/**
 * Only same-site paths are allowed after sign-in, so a crafted link cannot bounce users to another
 * site. The value is resolved the way a browser would (which silently drops tabs and newlines and
 * treats backslashes as slashes) and accepted only if it stays on this origin.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || /[\x00-\x1f\x7f\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
