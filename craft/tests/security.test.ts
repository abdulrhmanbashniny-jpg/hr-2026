import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/safe-next';

describe('safeNext', () => {
  it('keeps same-site paths with query and hash', () => {
    expect(safeNext('/app/rewards?tab=history#top', '/app')).toBe('/app/rewards?tab=history#top');
  });

  it('refuses anything that a browser would send to another origin', () => {
    for (const evil of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/%09/evil.example'.replace('%09', '\t'), 'https://evil.example', 'javascript:alert(1)', '\\\\evil.example', ''])
      expect(safeNext(evil, '/app')).toBe('/app');
  });

  it('falls back when nothing is given', () => {
    expect(safeNext(null, '/admin')).toBe('/admin');
    expect(safeNext(undefined, '/admin')).toBe('/admin');
  });
});
