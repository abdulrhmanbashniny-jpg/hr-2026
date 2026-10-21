/** Only same-site paths are allowed after sign-in, so a crafted link cannot bounce users to another site. */
export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  return next;
}
