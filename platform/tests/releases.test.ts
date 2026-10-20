import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, RELEASES } from '@/lib/releases';

const parse = (v: string) => v.split('.').map(Number) as [number, number];

describe('release numbering', () => {
  it('lists releases newest first with valid numbers and notes in both languages', () => {
    for (const r of RELEASES) {
      expect(r.version).toMatch(/^\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.ar.length).toBeGreaterThan(0);
      expect(r.en.length).toBe(r.ar.length);
    }
    for (let i = 1; i < RELEASES.length; i++) expect(RELEASES[i - 1].date >= RELEASES[i].date).toBe(true);
  });

  it('raises the decimal for a small update and the whole number for a major one', () => {
    for (let i = 0; i < RELEASES.length - 1; i++) {
      const [major, minor] = parse(RELEASES[i].version);
      const [prevMajor, prevMinor] = parse(RELEASES[i + 1].version);
      if (RELEASES[i].kind === 'major') expect([major, minor]).toEqual([prevMajor + 1, 0]);
      else expect([major, minor]).toEqual([prevMajor, prevMinor + 1]);
    }
    expect(RELEASES.at(-1)!.version).toBe('1.0');
  });

  it('keeps package.json in step with the shown version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(pkg.version).toBe(`${APP_VERSION}.0`);
  });
});
