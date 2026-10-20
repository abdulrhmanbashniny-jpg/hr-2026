'use server';

import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { driverCards, gosiSubscribers, operatingCards, residents, vehicles } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { bool, runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/guards';
import type { Permission } from '@/lib/auth/rbac';
import { normalizeDateInput, toHijri } from '@/lib/dates';
import { f, getI18n } from '@/lib/i18n';
import { cleanCardNumber, cleanId, cleanNumber, normalizeArabic } from '@/lib/imports/normalize';
import { TEMPLATES } from '@/lib/imports/templates';
import { syncTenantAlerts } from '@/lib/rules/sync';

export type RecordKind = 'residents' | 'gosi' | 'vehicles' | 'operating_cards' | 'driver_cards';

const TABLES = { residents, gosi: gosiSubscribers, vehicles, operating_cards: operatingCards, driver_cards: driverCards } as const;
const PERMISSION: Record<RecordKind, Permission> = {
  residents: 'people:write',
  gosi: 'people:write',
  driver_cards: 'people:write',
  vehicles: 'fleet:write',
  operating_cards: 'fleet:write',
};
const PATHS: Record<RecordKind, string> = {
  residents: '/app/residents',
  gosi: '/app/gosi',
  vehicles: '/app/fleet',
  operating_cards: '/app/operating-cards',
  driver_cards: '/app/driver-cards',
};

type FieldSpec = { type: 'date'; hijri?: string } | { type: 'bool' } | { type: 'text'; max: number } | { type: 'enum'; values: string[] } | { type: 'probation' } | { type: 'reviewed' };

/** Fields a user may edit by hand for each template. Anything else comes only from the government files. */
const EDITABLE: Record<RecordKind, Record<string, FieldSpec>> = {
  residents: {
    iqamaExpiry: { type: 'date', hijri: 'iqamaExpiryHijri' },
    passportExpiry: { type: 'date' },
    outsideKingdom: { type: 'bool' },
  },
  gosi: {
    probationDays: { type: 'probation' },
    probationReviewedAt: { type: 'reviewed' },
  },
  vehicles: {
    licenseExpiry: { type: 'date', hijri: 'licenseExpiryHijri' },
    inspectionExpiry: { type: 'date', hijri: 'inspectionExpiryHijri' },
    insuranceStatus: { type: 'enum', values: ['ساري المفعول', 'غير ساري'] },
    operatingCardRequirement: { type: 'enum', values: ['auto', 'required', 'exempt'] },
  },
  operating_cards: {
    expiryDate: { type: 'date' },
    cardStatus: { type: 'enum', values: ['نشط', 'منتهية', 'ملغاة', 'موقوفة'] },
  },
  driver_cards: {
    expiryDate: { type: 'date' },
    requestStatus: { type: 'enum', values: ['نشط', 'منتهية', 'ملغاة', 'قيد المعالجة'] },
  },
};

async function afterChange(tenantId: string, kind: RecordKind) {
  await syncTenantAlerts(tenantId);
  revalidatePath(PATHS[kind]);
  revalidatePath('/app', 'layout');
}

export async function updateRecord(kind: RecordKind, id: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission(PERMISSION[kind]);
    const { t } = await getI18n();
    const table = TABLES[kind] as unknown as typeof residents;
    const [current] = await db.select().from(table).where(and(eq(table.id, id), eq(table.tenantId, s.tenant.id)));
    if (!current) return { ok: false, error: t.common.error };

    const patch: Record<string, unknown> = {};
    for (const [field, spec] of Object.entries(EDITABLE[kind])) {
      if (!form.has(field) && spec.type !== 'bool' && spec.type !== 'reviewed') continue;
      const raw = str(form, field);
      switch (spec.type) {
        case 'date': {
          if (!raw) break;
          const iso = normalizeDateInput(raw, str(form, `${field}__calendar`) === 'hijri' ? 'hijri' : 'gregorian');
          if (!iso) return { ok: false, error: `${t.common.error} (${raw})` };
          patch[field] = iso;
          if (spec.hijri) patch[spec.hijri] = toHijri(iso);
          break;
        }
        case 'bool':
          if (form.has(`${field}__present`)) patch[field] = bool(form, field);
          break;
        case 'text':
          patch[field] = raw.slice(0, spec.max) || null;
          break;
        case 'enum':
          if (spec.values.includes(raw)) patch[field] = raw;
          break;
        case 'probation':
          patch[field] = raw === '90' || raw === '180' ? Number(raw) : null;
          break;
        case 'reviewed':
          if (form.has(`${field}__present`)) patch[field] = bool(form, field) ? ((current as Record<string, unknown>)[field] ?? new Date()) : null;
          break;
      }
    }
    const currentValues = current as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      const before = currentValues[k];
      const same = before instanceof Date && v instanceof Date ? before.getTime() === v.getTime() : before === v;
      if (same) delete patch[k];
    }
    if (!Object.keys(patch).length) return { ok: true, message: t.common.saved };
    const changes = Object.entries(patch)
      .filter(([k]) => !k.endsWith('Hijri'))
      .map(([k, v]) => `${k}: ${String((current as Record<string, unknown>)[k] ?? '—')} → ${v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '—')}`);
    await db
      .update(table)
      .set({ ...(patch as Partial<typeof table.$inferInsert>), manuallyUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(table.id, id));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `${kind}.manual_update`, entityType: kind, entityId: id, summary: `تحديث يدوي: ${changes.join('، ')}`, metadata: { patch } });
    await afterChange(s.tenant.id, kind);
    return { ok: true, message: t.common.saved };
  });
}

export async function archiveRecord(kind: RecordKind, id: string, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission(PERMISSION[kind]);
    const { t } = await getI18n();
    const reason = str(form, 'reason').slice(0, 300) || 'other';
    const table = TABLES[kind] as unknown as typeof residents;
    const now = new Date();
    const rows = await db
      .update(table)
      .set({ recordStatus: 'archived', archivedAt: now, archiveReason: reason, updatedAt: now })
      .where(and(eq(table.id, id), eq(table.tenantId, s.tenant.id)))
      .returning({ id: table.id });
    if (!rows.length) return { ok: false, error: t.common.error };
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `${kind}.archived`, entityType: kind, entityId: id, summary: `أرشفة سجل (${reason})`, metadata: { reason } });
    await afterChange(s.tenant.id, kind);
    return { ok: true, message: t.common.saved };
  });
}

export async function restoreRecord(kind: RecordKind, id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission(PERMISSION[kind]);
    const { t } = await getI18n();
    const table = TABLES[kind] as unknown as typeof residents;
    await db
      .update(table)
      .set({ recordStatus: 'active', archivedAt: null, archiveReason: null, missingSince: null, updatedAt: new Date() })
      .where(and(eq(table.id, id), eq(table.tenantId, s.tenant.id)));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `${kind}.restored`, entityType: kind, entityId: id, summary: 'استعادة سجل من الأرشيف' });
    await afterChange(s.tenant.id, kind);
    return { ok: true, message: t.common.saved };
  });
}

// ───────────────────────── Full record editing ─────────────────────────

type FormValue = string | boolean | null;

/** Hijri companion columns are derived from their Gregorian date, never typed. */
function derivedFields(kind: RecordKind): Set<string> {
  const def = TEMPLATES[kind];
  return new Set([...Object.values(def.companions), ...def.fields.flatMap((x) => (x.hijriField ? [x.hijriField] : []))]);
}

/** Every column of one record as form values (dates as YYYY-MM-DD), for the full edit form. */
export async function loadRecord(kind: RecordKind, id: string): Promise<ActionResult<Record<string, FormValue>>> {
  return runAction(async () => {
    const s = await requirePermission(PERMISSION[kind], { allowReadOnly: true });
    const { t } = await getI18n();
    const table = TABLES[kind] as unknown as typeof residents;
    const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.tenantId, s.tenant.id)));
    if (!row) return { ok: false, error: t.common.error };
    const out: Record<string, FormValue> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = v === null || v === undefined ? null : typeof v === 'boolean' ? v : v instanceof Date ? v.toISOString() : String(v);
    }
    return { ok: true, data: out };
  });
}

/** Creates a record by hand (id null) or rewrites every field of an existing one. */
export async function saveRecord(kind: RecordKind, id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission(PERMISSION[kind]);
    const { t, locale } = await getI18n();
    const def = TEMPLATES[kind];
    const table = TABLES[kind] as unknown as typeof residents;
    const skip = derivedFields(kind);
    const values: Record<string, unknown> = {};
    const label = (field: string) => {
      const fd = def.fields.find((x) => x.field === field);
      return fd ? (locale === 'ar' ? fd.labelAr : fd.labelEn) : field;
    };

    for (const fd of def.fields) {
      if (skip.has(fd.field)) continue;
      const raw = str(form, fd.field);
      let v: unknown = null;
      switch (fd.type) {
        case 'id':
          v = cleanId(raw);
          break;
        case 'cardNumber':
          v = cleanCardNumber(raw);
          break;
        case 'date':
        case 'hijriDate': {
          if (!raw) break;
          const iso = normalizeDateInput(raw, str(form, `${fd.field}__calendar`) === 'hijri' ? 'hijri' : 'gregorian');
          if (!iso) return { ok: false, error: `${label(fd.field)}: ${t.common.error} (${raw})` };
          v = iso;
          if (fd.hijriField) values[fd.hijriField] = toHijri(iso);
          if (def.companions[fd.field]) values[def.companions[fd.field]] = toHijri(iso);
          break;
        }
        case 'bool':
          v = bool(form, fd.field);
          break;
        case 'int': {
          const n = cleanNumber(raw);
          v = n === null ? null : Math.trunc(n);
          break;
        }
        case 'money':
          v = cleanNumber(raw) ?? 0;
          break;
        default:
          v = raw.slice(0, 300) || null;
      }
      if (fd.required && (v === null || v === '')) return { ok: false, error: f(t.records.required, { field: label(fd.field) }) };
      values[fd.field] = v;
    }

    const key = String(values[def.keyField] ?? '');
    const check = def.validateKey(key);
    if (!check.ok) return { ok: false, error: check.error ?? t.common.error };
    const [dup] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.tenantId, s.tenant.id), eq((table as unknown as Record<string, typeof table.id>)[def.keyField], key), id ? ne(table.id, id) : undefined));
    if (dup) return { ok: false, error: f(t.records.duplicate, { field: label(def.keyField) }) };

    if (kind === 'gosi') {
      const nationality = normalizeArabic(String(values.nationality ?? ''));
      values.isSaudi = nationality === normalizeArabic('السعودية') || nationality === 'saudi' || (nationality === '' && key.startsWith('1'));
      const probation = str(form, 'probationDays');
      values.probationDays = probation === '90' || probation === '180' ? Number(probation) : null;
    }
    if (kind === 'vehicles') {
      const req = str(form, 'operatingCardRequirement');
      if (['auto', 'required', 'exempt'].includes(req)) values.operatingCardRequirement = req;
    }

    const name = def.labelFields.map((x) => values[x]).filter(Boolean).join(' ') || key;
    const now = new Date();
    if (id) {
      const rows = await db
        .update(table)
        .set({ ...(values as Partial<typeof table.$inferInsert>), manuallyUpdatedAt: now, updatedAt: now })
        .where(and(eq(table.id, id), eq(table.tenantId, s.tenant.id)))
        .returning({ id: table.id });
      if (!rows.length) return { ok: false, error: t.common.error };
      await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `${kind}.edited`, entityType: kind, entityId: id, summary: `تعديل كامل لبيانات «${name}»` });
    } else {
      const [row] = await db
        .insert(table)
        .values({ ...(values as typeof table.$inferInsert), tenantId: s.tenant.id, recordStatus: 'active', manuallyUpdatedAt: now })
        .returning({ id: table.id });
      await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `${kind}.created`, entityType: kind, entityId: row.id, summary: `إضافة سجل يدوياً: «${name}»` });
    }
    await afterChange(s.tenant.id, kind);
    return { ok: true, message: id ? t.common.saved : t.records.created };
  });
}

/** Removes a record and its alerts for good. Archiving is the reversible alternative. */
export async function deleteRecord(kind: RecordKind, id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission(PERMISSION[kind]);
    const { t } = await getI18n();
    const def = TEMPLATES[kind];
    const table = TABLES[kind] as unknown as typeof residents;
    const [row] = await db
      .delete(table)
      .where(and(eq(table.id, id), eq(table.tenantId, s.tenant.id)))
      .returning();
    if (!row) return { ok: false, error: t.common.error };
    const values = row as Record<string, unknown>;
    const name = def.labelFields.map((x) => values[x]).filter(Boolean).join(' ') || String(values[def.keyField]);
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `${kind}.deleted`, entityType: kind, entityId: id, summary: `حذف السجل نهائياً: «${name}» (${values[def.keyField]})`, metadata: { key: values[def.keyField] } });
    await afterChange(s.tenant.id, kind);
    return { ok: true, message: t.records.deleted };
  });
}
