import { describe, expect, it } from 'vitest';
import { addDays, bucketForDays, daysUntil, normalizeDateInput } from '@/lib/dates';
import { gregorianToHijriString, hijriStringToGregorian, hijriToGregorian } from '@/lib/dates/hijri';

// Gregorian ↔ Hijri pairs as printed side by side in a Muqeem "active residents" export.
const MUQEEM_PAIRS: [string, string][] = [
  ['2027-01-09', '1448-08-01'],
  ['2027-01-30', '1448-08-22'],
  ['2020-09-30', '1442-02-13'],
  ['2026-11-26', '1448-06-16'],
  ['2027-08-08', '1449-03-06'],
  ['2028-02-01', '1449-09-05'],
  ['2026-12-31', '1448-07-22'],
  ['2027-05-29', '1448-12-23'],
];

describe('Umm al-Qura conversion', () => {
  it.each(MUQEEM_PAIRS)('%s ↔ %s', (g, h) => {
    expect(gregorianToHijriString(g)).toBe(h);
    expect(hijriStringToGregorian(h)).toBe(g);
  });

  it('round-trips every day of two years', () => {
    let d = '2025-01-01';
    for (let i = 0; i < 730; i++) {
      expect(hijriStringToGregorian(gregorianToHijriString(d))).toBe(d);
      d = addDays(d, 1);
    }
  });

  it('rejects impossible Hijri dates', () => {
    expect(hijriToGregorian(1448, 13, 1)).toBeNull();
    expect(hijriToGregorian(1250, 1, 1)).toBeNull();
    // A 29-day month has no 30th.
    const month29 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => hijriToGregorian(1448, m, 30) === null);
    expect(month29).toBeDefined();
  });

  it('treats years below 1600 as Hijri when the calendar is unknown (Tamm exports)', () => {
    expect(normalizeDateInput('1449-08-23')).toBe('2028-01-20');
    expect(normalizeDateInput('2028-01-20')).toBe('2028-01-20');
    expect(normalizeDateInput('20/01/2028')).toBe('2028-01-20');
    expect(normalizeDateInput('2028-02-30')).toBeNull();
  });
});

describe('expiry buckets', () => {
  it('maps days to the five buckets', () => {
    expect(bucketForDays(null)).toBe('none');
    expect(bucketForDays(-3)).toBe('expired');
    expect(bucketForDays(0)).toBe('expired');
    expect(bucketForDays(1)).toBe('d30');
    expect(bucketForDays(30)).toBe('d30');
    expect(bucketForDays(31)).toBe('d60');
    expect(bucketForDays(60)).toBe('d60');
    expect(bucketForDays(90)).toBe('d90');
    expect(bucketForDays(91)).toBe('valid');
  });
  it('counts days between calendar dates', () => {
    expect(daysUntil('2026-10-30', '2026-10-20')).toBe(10);
    expect(daysUntil('2026-10-10', '2026-10-20')).toBe(-10);
  });
});
