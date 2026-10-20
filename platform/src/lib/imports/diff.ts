import { valuesEqual } from './normalize';
import type { TemplateDef } from './templates';
import type { DateChange, FieldValue, NormalizedRecord } from './types';

export type RowDecision =
  | { kind: 'unchanged' }
  | { kind: 'updated'; patch: NormalizedRecord; fields: string[] }
  | { kind: 'stale'; older: DateChange[] }
  | { kind: 'conflict'; patch: NormalizedRecord; fields: string[]; kept: DateChange[] };

type DateOrder = 'newer' | 'older' | 'same';

function compareDate(fileValue: FieldValue | undefined, current: FieldValue | undefined): DateOrder {
  const f = typeof fileValue === 'string' ? fileValue : null;
  const c = typeof current === 'string' ? current : null;
  if (f === c) return 'same';
  if (c === null) return 'newer';
  if (f === null) return 'older'; // the file lacks a date we already know: never erase it
  return f > c ? 'newer' : 'older';
}

/**
 * Decides how an uploaded row relates to the stored record.
 *
 * - Every tracked expiry date the same or newer → apply the whole row (`updated`, or `unchanged`).
 * - Tracked dates only older (none newer) → the file is behind what we hold; write nothing (`stale`).
 * - Some newer, some older → apply the newer dates and the plain fields, keep the newer stored dates
 *   (`conflict`), so a manual renewal entered in the platform is never overwritten by an old export.
 */
export function decideRow(template: TemplateDef, incoming: NormalizedRecord, current: NormalizedRecord): RowDecision {
  const companionOf = new Map(Object.entries(template.companions).map(([date, companion]) => [companion, date]));
  const orders = new Map<string, DateOrder>();
  for (const field of template.trackedDates) orders.set(field, compareDate(incoming[field], current[field]));

  const older = [...orders].filter(([, o]) => o === 'older').map(([field]) => field);
  const newer = [...orders].filter(([, o]) => o === 'newer').map(([field]) => field);
  const toChange = (field: string): DateChange => ({
    field,
    fileValue: (incoming[field] as string | null) ?? null,
    currentValue: (current[field] as string | null) ?? null,
  });

  if (older.length > 0 && newer.length === 0) return { kind: 'stale', older: older.map(toChange) };

  const patch: NormalizedRecord = {};
  const fields: string[] = [];
  for (const [field, value] of Object.entries(incoming)) {
    if (orders.get(field) === 'older') continue;
    const parentDate = companionOf.get(field);
    if (parentDate && orders.get(parentDate) === 'older') continue;
    if (!valuesEqual(value, current[field])) {
      patch[field] = value;
      fields.push(field);
    }
  }

  if (older.length > 0) return { kind: 'conflict', patch, fields, kept: older.map(toChange) };
  if (fields.length === 0) return { kind: 'unchanged' };
  return { kind: 'updated', patch, fields };
}

/** A file is "stale" when at least half of the rows we already knew carry older expiry dates. */
export function isFileStale(counts: { matched: number; stale: number; conflicts: number }): boolean {
  if (counts.matched === 0 || counts.stale === 0) return false;
  return (counts.stale + counts.conflicts) / counts.matched >= 0.5;
}
