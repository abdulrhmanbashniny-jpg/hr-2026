import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/auth/safe-next';

const app = 'https://mutabaa-nine.vercel.app';

describe('redirect after sign-in', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/app/settings?tab=channels', app)).toBe('/app/settings?tab=channels');
    expect(safeNext('/invite/abc', app)).toBe('/invite/abc');
  });
  it('refuses anything that can leave the site', () => {
    for (const bad of ['//evil.example', '/\\evil.example', '/\\\\evil.example', '/\t/evil.example', 'https://evil.example', 'javascript:alert(1)', '/%0a/evil', ' /app']) {
      const out = safeNext(bad, app);
      expect(new URL(out, app).origin, bad).toBe(app);
    }
    expect(safeNext('/\\evil.example', app)).toBe('/app');
  });
});
