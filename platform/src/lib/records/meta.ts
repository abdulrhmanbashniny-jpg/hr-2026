import type { Permission } from '@/lib/auth/rbac';

export type RecordKind = 'residents' | 'gosi' | 'vehicles' | 'operating_cards' | 'driver_cards';

/** The list page of each record type; its add and edit pages live under it (`/new`, `/edit/<id>`). */
export const RECORD_PATHS: Record<RecordKind, string> = {
  residents: '/app/residents',
  gosi: '/app/gosi',
  vehicles: '/app/fleet',
  operating_cards: '/app/operating-cards',
  driver_cards: '/app/driver-cards',
};

export const RECORD_PERMISSION: Record<RecordKind, Permission> = {
  residents: 'people:write',
  gosi: 'people:write',
  driver_cards: 'people:write',
  vehicles: 'fleet:write',
  operating_cards: 'fleet:write',
};

export const recordNewPath = (kind: RecordKind) => `${RECORD_PATHS[kind]}/new`;
export const recordEditPath = (kind: RecordKind, id: string) => `${RECORD_PATHS[kind]}/edit/${id}`;

/** A short human name for a record, used in page titles. */
export function recordDisplayName(kind: RecordKind, v: Record<string, unknown>): string {
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string).trim() : '');
  switch (kind) {
    case 'residents':
    case 'gosi':
      return s('name');
    case 'vehicles':
      return s('plateNumber') || s('sequenceNumber');
    case 'driver_cards':
      return `${s('firstName')} ${s('lastName')}`.trim() || s('cardNumber');
    case 'operating_cards':
      return s('cardNumber');
  }
}
