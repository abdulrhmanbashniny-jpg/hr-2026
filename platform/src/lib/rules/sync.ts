import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  authorities,
  complianceAlerts,
  documents,
  driverCards,
  gosiSubscribers,
  importBatches,
  operatingCards,
  residents,
  tenants,
  vehicles,
} from '@/db/schema';
import { todayRiyadh } from '@/lib/dates';
import { resolveSettings, type TenantSettings } from '@/lib/settings';
import { evaluateRules, type AlertCandidate, type RulesInput } from './engine';

export async function loadRulesInput(tenantId: string, today = todayRiyadh()): Promise<RulesInput & { settings: TenantSettings }> {
  const [tenant] = await db.select({ settings: tenants.settings }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error('Tenant not found');
  const [res, gosi, veh, opc, drv, docs, auths, batches] = await Promise.all([
    db.select().from(residents).where(and(eq(residents.tenantId, tenantId), ne(residents.recordStatus, 'archived'))),
    db.select().from(gosiSubscribers).where(and(eq(gosiSubscribers.tenantId, tenantId), ne(gosiSubscribers.recordStatus, 'archived'))),
    db.select().from(vehicles).where(and(eq(vehicles.tenantId, tenantId), ne(vehicles.recordStatus, 'archived'))),
    db.select().from(operatingCards).where(and(eq(operatingCards.tenantId, tenantId), ne(operatingCards.recordStatus, 'archived'))),
    db.select().from(driverCards).where(and(eq(driverCards.tenantId, tenantId), ne(driverCards.recordStatus, 'archived'))),
    db.select().from(documents).where(and(eq(documents.tenantId, tenantId), ne(documents.status, 'archived'))),
    db.select().from(authorities),
    db.selectDistinct({ template: importBatches.template }).from(importBatches).where(eq(importBatches.tenantId, tenantId)),
  ]);
  const authById = new Map(auths.map((a) => [a.id, a]));
  const imported = new Set(batches.map((b) => b.template));
  // Data that exists without an import (seeded or entered manually) also counts as "known".
  const has = (k: 'residents' | 'gosi' | 'vehicles' | 'operating_cards' | 'driver_cards', rows: unknown[]) => imported.has(k) || rows.length > 0;
  return {
    today,
    settings: resolveSettings(tenant.settings),
    residents: res,
    gosi,
    vehicles: veh,
    operatingCards: opc,
    driverCards: drv,
    documents: docs.map((d) => ({ ...d, authority: d.authorityId ? (authById.get(d.authorityId) ?? null) : null })),
    imported: {
      residents: has('residents', res),
      gosi: has('gosi', gosi),
      vehicles: has('vehicles', veh),
      operating_cards: has('operating_cards', opc),
      driver_cards: has('driver_cards', drv),
    },
  };
}

export interface SyncResult {
  opened: (AlertCandidate & { id: string })[];
  updated: number;
  resolved: number;
  total: number;
}

/**
 * Re-evaluates every rule for a tenant and reconciles the alert table by fingerprint:
 * new findings are opened, existing ones refreshed (keeping acknowledge/snooze state), and findings
 * that no longer hold — a renewed date, an uploaded card, an archived record — are resolved.
 */
export async function syncTenantAlerts(tenantId: string, today = todayRiyadh()): Promise<SyncResult> {
  const input = await loadRulesInput(tenantId, today);
  const candidates = evaluateRules(input);
  const now = new Date();

  const existing = await db.select().from(complianceAlerts).where(eq(complianceAlerts.tenantId, tenantId));
  const byFingerprint = new Map(existing.map((a) => [a.fingerprint, a]));
  const seen = new Set<string>();
  const opened: SyncResult['opened'] = [];
  let updated = 0;
  let resolved = 0;

  await db.transaction(async (tx) => {
    for (const c of candidates) {
      if (seen.has(c.fingerprint)) continue;
      seen.add(c.fingerprint);
      const prev = byFingerprint.get(c.fingerprint);
      const fields = {
        ruleCode: c.ruleCode,
        module: c.module,
        severity: c.severity,
        entityType: c.entityType,
        entityId: c.entityId,
        entityKey: c.entityKey,
        entityLabel: c.entityLabel,
        titleAr: c.titleAr,
        titleEn: c.titleEn,
        detailAr: c.detailAr,
        detailEn: c.detailEn,
        dueDate: c.dueDate,
        link: c.link,
        lastSeenAt: now,
      };
      if (!prev) {
        const [row] = await tx
          .insert(complianceAlerts)
          .values({ ...fields, tenantId, fingerprint: c.fingerprint, status: 'open', firstSeenAt: now })
          .returning({ id: complianceAlerts.id });
        opened.push({ ...c, id: row.id });
        continue;
      }
      let status = prev.status;
      let snoozedUntil = prev.snoozedUntil;
      let resolvedAt = prev.resolvedAt;
      let resolvedReason = prev.resolvedReason;
      if (status === 'resolved') {
        status = 'open';
        resolvedAt = null;
        resolvedReason = null;
        opened.push({ ...c, id: prev.id });
      } else if (status === 'snoozed' && snoozedUntil && snoozedUntil <= now) {
        status = 'open';
        snoozedUntil = null;
      }
      await tx
        .update(complianceAlerts)
        .set({ ...fields, status, snoozedUntil, resolvedAt, resolvedReason })
        .where(eq(complianceAlerts.id, prev.id));
      updated++;
    }

    const toResolve = existing.filter((a) => a.status !== 'resolved' && !seen.has(a.fingerprint)).map((a) => a.id);
    if (toResolve.length) {
      await tx
        .update(complianceAlerts)
        .set({ status: 'resolved', resolvedAt: now, resolvedReason: 'condition_cleared', snoozedUntil: null })
        .where(inArray(complianceAlerts.id, toResolve));
    }
    resolved = toResolve.length;
  });

  return { opened, updated, resolved, total: seen.size };
}
