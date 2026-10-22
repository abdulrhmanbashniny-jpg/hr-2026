export type PaintKind = 'interior' | 'exterior' | 'enamel';

/** Spread rate per coat in m² per litre, for typical Saudi market products. */
export const COVERAGE: Record<PaintKind, number> = { interior: 11, exterior: 8, enamel: 12 };
const PRIMER_COVERAGE = 9;
const WASTE = 1.1;
const BIG = 18;
const SMALL = 3.6;

export interface EstimateInput {
  /** Either a measured wall area… */
  areaSqm?: number;
  /** …or a room to measure (metres). */
  room?: { length: number; width: number; height: number; includeCeiling: boolean };
  openingsSqm?: number;
  coats: number;
  kind: PaintKind;
  primer: boolean;
}

export interface Estimate {
  paintableSqm: number;
  liters: number;
  primerLiters: number;
  buckets: { big: number; small: number };
  primerBuckets: { big: number; small: number };
}

/** Fewest containers without paying for more than one extra small can of leftover. */
export function packBuckets(liters: number): { big: number; small: number } {
  if (liters <= 0) return { big: 0, small: 0 };
  let big = Math.floor(liters / BIG);
  const rest = liters - big * BIG;
  let small = Math.ceil(rest / SMALL - 1e-9);
  if (small * SMALL >= BIG - SMALL) {
    big += 1;
    small = 0;
  }
  return { big, small };
}

export function estimatePaint(input: EstimateInput): Estimate {
  let area = input.areaSqm ?? 0;
  if (input.room) {
    const { length, width, height, includeCeiling } = input.room;
    area = 2 * (length + width) * height + (includeCeiling ? length * width : 0);
  }
  const paintableSqm = Math.max(0, Math.round((area - (input.openingsSqm ?? 0)) * 10) / 10);
  const coats = Math.min(4, Math.max(1, Math.round(input.coats)));
  const liters = Math.round(((paintableSqm * coats) / COVERAGE[input.kind]) * WASTE * 10) / 10;
  const primerLiters = input.primer ? Math.round((paintableSqm / PRIMER_COVERAGE) * WASTE * 10) / 10 : 0;
  return { paintableSqm, liters, primerLiters, buckets: packBuckets(liters), primerBuckets: packBuckets(primerLiters) };
}
