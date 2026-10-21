import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { can, TEMPLATE_PERMISSION } from '@/lib/auth/rbac';
import { getSession } from '@/lib/auth/session';
import { getI18n } from '@/lib/i18n';
import { applyImport } from '@/lib/imports/apply';
import { parseTemplate } from '@/lib/imports/parse';
import { TEMPLATES } from '@/lib/imports/templates';
import { ImportError, TEMPLATE_KEYS, type TemplateKey } from '@/lib/imports/types';
import { dispatchTenant } from '@/lib/notifications/dispatch';
import { syncTenantAlerts } from '@/lib/rules/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Receives a government Excel export, parses it in memory, applies the smart upsert and discards the
 * bytes. The file is never written to disk or object storage.
 */
export async function POST(req: Request) {
  const { t } = await getI18n();
  const s = await getSession();
  if (!s?.tenant || !s.role) return NextResponse.json({ error: t.common.forbidden }, { status: 401 });
  if (s.tenant.suspended) return NextResponse.json({ error: t.common.suspended }, { status: 403 });
  if (s.subscription && !s.subscription.canWrite && !s.supportMode) return NextResponse.json({ error: t.common.readOnly }, { status: 402 });
  // Only roles that may import something get the server to parse a file at all.
  if (!Object.values(TEMPLATE_PERMISSION).some((perm) => can(s.role, perm))) return NextResponse.json({ error: t.common.forbidden }, { status: 403 });
  // Refuse oversized bodies before reading them into memory.
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (!declared || declared > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: t.imports.tooLarge }, { status: 413 });

  const form = await req.formData();
  const file = form.get('file');
  const requested = String(form.get('template') ?? 'auto');
  const expected = (TEMPLATE_KEYS as string[]).includes(requested) ? (requested as TemplateKey) : undefined;
  if (!(file instanceof File)) return NextResponse.json({ error: t.imports.wrongType }, { status: 400 });
  if (expected && !can(s.role, TEMPLATE_PERMISSION[expected])) return NextResponse.json({ error: t.common.forbidden }, { status: 403 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: t.imports.tooLarge }, { status: 413 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: t.imports.wrongType }, { status: 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseTemplate(bytes, expected);
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message, code: err.code, details: err.details }, { status: 422 });
    console.error('import parse failed', err);
    return NextResponse.json({ error: t.common.error }, { status: 500 });
  } finally {
    bytes.fill(0); // zero-file-retention: wipe the in-memory copy as soon as parsing ends
  }
  const fileDiscardedAt = new Date();

  if (!can(s.role, TEMPLATE_PERMISSION[parsed.template])) return NextResponse.json({ error: t.common.forbidden }, { status: 403 });

  const { batchId, report } = await applyImport({
    tenantId: s.tenant.id,
    userId: s.user.id,
    fileName: file.name,
    fileSize: file.size,
    parsed,
    fileDiscardedAt,
  });
  const sync = await syncTenantAlerts(s.tenant.id);
  await dispatchTenant(s.tenant.id).catch((err) => console.error('dispatch after import failed', err));
  await audit({
    tenantId: s.tenant.id,
    userId: s.user.id,
    action: 'import.applied',
    entityType: 'import',
    entityId: batchId,
    summary: `رفع «${TEMPLATES[parsed.template].nameAr}» (${file.name}): ${report.created.length} جديد، ${report.updated.length} محدّث، ${report.stale.length} أقدم، ${report.missing.length} اختفى — حُذف الملف الأصلي`,
    metadata: { rows: report.rows, errors: report.errors.length, fileIsStale: report.fileIsStale },
  });

  return NextResponse.json({
    batchId,
    template: parsed.template,
    counts: {
      rows: report.rows,
      created: report.created.length,
      updated: report.updated.length,
      stale: report.stale.length,
      conflicts: report.conflicts.length,
      missing: report.missing.length,
      errors: report.errors.length,
      warnings: report.warnings.length,
    },
    fileIsStale: report.fileIsStale,
    missingDetectionSkipped: report.missingDetectionSkipped,
    alertsOpened: sync.opened.length,
    fileDiscardedAt: fileDiscardedAt.toISOString(),
  });
}
