import { describe, expect, it } from 'vitest';
import { estimatePaint, packBuckets } from '@/lib/estimator';
import { nextReward } from '@/lib/rewards/progress';
import { ALLOWED_BY_PURPOSE, sameFamily, sniffMime } from '@/lib/sniff';
import { trustBand, trustScore } from '@/lib/trust';

describe('trust score', () => {
  it('scores a fully verified gold craftsman near the top', () => {
    const r = trustScore({ tier: 'A', identityStatus: 'verified', licenseStatus: 'verified', projects: 6, fieldVerifiedProjects: 3, approvedInvoices: 12, accountAgeDays: 400, yearsExperience: 15 });
    expect(r.score).toBe(100);
    expect(trustBand(r.score)).toBe('excellent');
  });

  it('gives a brand-new account a low, explainable score', () => {
    const r = trustScore({ tier: 'C', identityStatus: 'unverified', licenseStatus: 'pending', projects: 1, fieldVerifiedProjects: 0, approvedInvoices: 0, accountAgeDays: 1, yearsExperience: 3 });
    expect(r.score).toBe(5 + 1 + 1);
    expect(r.parts.find((p) => p.key === 'identity')).toEqual({ key: 'identity', points: 0, max: 20 });
    expect(trustBand(r.score)).toBe('new');
  });
});

describe('paint estimator', () => {
  it('measures a room, removes openings and adds waste', () => {
    const r = estimatePaint({ room: { length: 5, width: 4, height: 3, includeCeiling: true }, openingsSqm: 4, coats: 2, kind: 'interior', primer: true });
    expect(r.paintableSqm).toBe(70);
    expect(r.liters).toBeCloseTo(14, 0);
    expect(r.buckets).toEqual({ big: 1, small: 0 });
    expect(r.primerLiters).toBeCloseTo(8.6, 1);
  });

  it('packs litres into 18 L and 3.6 L containers', () => {
    expect(packBuckets(0)).toEqual({ big: 0, small: 0 });
    expect(packBuckets(3)).toEqual({ big: 0, small: 1 });
    expect(packBuckets(7)).toEqual({ big: 0, small: 2 });
    expect(packBuckets(16)).toEqual({ big: 1, small: 0 });
    expect(packBuckets(40)).toEqual({ big: 2, small: 2 });
  });
});

describe('next reward', () => {
  const rewards = [
    { id: 'a', pointsCost: 500 },
    { id: 'b', pointsCost: 2000 },
    { id: 'c', pointsCost: 5000 },
  ];
  it('targets the cheapest reward out of reach, measured from the last one reached', () => {
    expect(nextReward(1250, rewards)).toEqual({ reward: rewards[1], remaining: 750, pct: 50 });
    expect(nextReward(0, rewards)).toEqual({ reward: rewards[0], remaining: 500, pct: 0 });
    expect(nextReward(6000, rewards)).toBeNull();
  });
});

describe('upload sniffing', () => {
  const bytes = (...b: (number | string)[]) => new Uint8Array(b.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));
  it('recognises formats by their magic bytes', () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMime(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffMime(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
    expect(sniffMime(bytes(0, 0, 0, 0x18, 'ftypisom'))).toBe('video/mp4');
    expect(sniffMime(bytes(0, 0, 0, 0x18, 'ftypavif'))).toBe('image/avif');
    expect(sniffMime(bytes('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffMime(bytes('<svg'))).toBeNull();
  });

  it('keeps invoices to photos and portfolios to photos and video', () => {
    expect((ALLOWED_BY_PURPOSE.invoice as readonly string[]).includes('video/mp4')).toBe(false);
    expect((ALLOWED_BY_PURPOSE.portfolio as readonly string[]).includes('video/mp4')).toBe(true);
    expect(sameFamily('video/quicktime', 'video/mp4')).toBe(true);
  });
});
