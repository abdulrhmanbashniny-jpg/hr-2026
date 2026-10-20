'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { authorities, contacts, documentBundleItems, documentBundles, documents, shareLinks } from '@/db/schema';
import type { ActionResult } from '@/lib/action-result';
import { num, optStr, runAction, str } from '@/lib/actions';
import { audit } from '@/lib/audit';
import { requirePermission } from '@/lib/auth/guards';
import { normalizeDateInput, toHijri } from '@/lib/dates';
import { shareDocuments, SHARE_EXPIRY_HOURS, type ShareChannel, type ShareResult } from '@/lib/documents/share';
import { f, getI18n } from '@/lib/i18n';
import { syncTenantAlerts } from '@/lib/rules/sync';
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, MAX_DOCUMENT_MB, storage } from '@/lib/storage';

function parseAlertDays(raw: string): number[] {
  const days = raw
    .split(/[,،\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
  return [...new Set(days)].sort((a, b) => b - a).slice(0, 8);
}

async function refresh(tenantId: string) {
  await syncTenantAlerts(tenantId);
  revalidatePath('/app/documents');
  revalidatePath('/app', 'layout');
}

export async function saveDocument(id: string | null, _prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('documents:write');
    const { t } = await getI18n();
    const title = str(form, 'title').slice(0, 200);
    if (title.length < 2) return { ok: false, error: `${t.documents.docTitle}: ${t.common.required}` };

    let authorityId = optStr(form, 'authorityId');
    const newAuthority = str(form, 'newAuthority').slice(0, 120);
    if (authorityId === '__new' && newAuthority) {
      const [a] = await db.insert(authorities).values({ tenantId: s.tenant.id, nameAr: newAuthority, nameEn: newAuthority }).returning({ id: authorities.id });
      authorityId = a.id;
    } else if (authorityId) {
      const [a] = await db
        .select({ id: authorities.id })
        .from(authorities)
        .where(and(eq(authorities.id, authorityId), or(isNull(authorities.tenantId), eq(authorities.tenantId, s.tenant.id))));
      authorityId = a?.id ?? null;
    }

    const date = (field: string) => {
      const raw = str(form, field);
      if (!raw) return { iso: null as string | null, ok: true };
      const iso = normalizeDateInput(raw, str(form, `${field}__calendar`) === 'hijri' ? 'hijri' : 'gregorian');
      return { iso, ok: !!iso };
    };
    const issue = date('issueDate');
    const expiry = date('expiryDate');
    if (!issue.ok || !expiry.ok) return { ok: false, error: t.common.error };

    let responsibleContactId = optStr(form, 'responsibleContactId');
    if (responsibleContactId) {
      const [c] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, responsibleContactId), eq(contacts.tenantId, s.tenant.id)));
      responsibleContactId = c?.id ?? null;
    }
    const externalUrl = str(form, 'externalUrl');
    if (externalUrl && !/^https:\/\/[^\s]+$/i.test(externalUrl)) return { ok: false, error: `${t.documents.externalUrl}: https://` };

    const values = {
      title,
      authorityId,
      referenceNumber: optStr(form, 'referenceNumber'),
      issueDate: issue.iso,
      expiryDate: expiry.iso,
      issueDateHijri: toHijri(issue.iso),
      expiryDateHijri: toHijri(expiry.iso),
      enteredCalendar: str(form, 'expiryDate__calendar') === 'hijri' ? 'hijri' : 'gregorian',
      alertDays: parseAlertDays(str(form, 'alertDays')).length ? parseAlertDays(str(form, 'alertDays')) : [60, 30, 15, 4],
      responsibleContactId,
      renewalFee: num(form, 'renewalFee') || null,
      externalUrl: externalUrl || null,
      notes: optStr(form, 'notes')?.slice(0, 2000) ?? null,
      updatedAt: new Date(),
    };

    let existing: typeof documents.$inferSelect | undefined;
    if (id) {
      [existing] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.tenantId, s.tenant.id)));
      if (!existing) return { ok: false, error: t.common.error };
    }

    const file = form.get('file');
    let fileFields: Partial<typeof documents.$inferInsert> = {};
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: f(t.documents.fileHint, { mb: MAX_DOCUMENT_MB }) };
      if (!ALLOWED_DOCUMENT_TYPES[file.type]) return { ok: false, error: f(t.documents.fileHint, { mb: MAX_DOCUMENT_MB }) };
      const key = `${s.tenant.id}/${randomUUID()}`;
      await storage().put(key, new Uint8Array(await file.arrayBuffer()), file.type);
      fileFields = { fileKey: key, fileName: file.name.slice(0, 200), fileMime: file.type, fileSize: file.size };
    }

    let docId = id;
    if (existing) {
      await db.update(documents).set({ ...values, ...fileFields }).where(eq(documents.id, existing.id));
      if (fileFields.fileKey && existing.fileKey) await storage().remove(existing.fileKey).catch(() => undefined);
      // A newer expiry date means the renewal is done.
      if (existing.status === 'renewal_in_progress' && values.expiryDate && (!existing.expiryDate || values.expiryDate > existing.expiryDate)) {
        await db.update(documents).set({ status: 'active' }).where(eq(documents.id, existing.id));
      }
    } else {
      const [row] = await db
        .insert(documents)
        .values({ ...values, ...fileFields, tenantId: s.tenant.id, createdBy: s.user.id })
        .returning({ id: documents.id });
      docId = row.id;
    }
    await audit({
      tenantId: s.tenant.id,
      userId: s.user.id,
      action: existing ? 'document.updated' : 'document.created',
      entityType: 'document',
      entityId: docId!,
      summary: `${existing ? 'تحديث' : 'إضافة'} مستند «${title}»${values.expiryDate ? ` ينتهي ${values.expiryDate}` : ''}${fileFields.fileKey ? ' مع رفع ملف' : ''}`,
    });
    await refresh(s.tenant.id);
    return { ok: true, message: t.common.saved };
  });
}

export async function setDocumentStatus(id: string, status: 'active' | 'renewal_in_progress' | 'archived'): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('documents:write');
    const { t } = await getI18n();
    const [row] = await db
      .update(documents)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.tenantId, s.tenant.id)))
      .returning({ title: documents.title });
    if (!row) return { ok: false, error: t.common.error };
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: `document.${status}`, entityType: 'document', entityId: id, summary: `«${row.title}» → ${status}` });
    await refresh(s.tenant.id);
    return { ok: true, message: t.common.saved };
  });
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('documents:write');
    const { t } = await getI18n();
    const [row] = await db.delete(documents).where(and(eq(documents.id, id), eq(documents.tenantId, s.tenant.id))).returning();
    if (!row) return { ok: false, error: t.common.error };
    if (row.fileKey) await storage().remove(row.fileKey).catch(() => undefined);
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'document.deleted', entityType: 'document', entityId: id, summary: `حذف مستند «${row.title}»` });
    await refresh(s.tenant.id);
    return { ok: true, message: t.common.saved };
  });
}

export interface ShareActionData {
  results: ShareResult[];
}

export async function shareDocumentsAction(_prev: ActionResult<ShareActionData> | null, form: FormData): Promise<ActionResult<ShareActionData>> {
  return runAction(async () => {
    const s = await requirePermission('documents:share');
    const { t } = await getI18n();
    const ids = form.getAll('documentIds').map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 50);
    if (!ids.length) return { ok: false, error: t.common.error };
    const docs = await db.select().from(documents).where(and(eq(documents.tenantId, s.tenant.id), inArray(documents.id, ids)));
    const channels = form.getAll('channels').map(String).filter((c): c is ShareChannel => c === 'email' || c === 'telegram' || c === 'whatsapp');
    if (!channels.length) return { ok: false, error: `${t.documents.channels}: ${t.common.required}` };
    const mode = str(form, 'mode') === 'attachment' ? 'attachment' : 'link';
    const hours = SHARE_EXPIRY_HOURS.includes(num(form, 'expiresInHours') as (typeof SHARE_EXPIRY_HOURS)[number]) ? num(form, 'expiresInHours') : 24;

    let recipient: { name: string; email?: string | null; phone?: string | null; telegramChatId?: string | null };
    const contactId = optStr(form, 'contactId');
    if (contactId) {
      const [c] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.tenantId, s.tenant.id)));
      if (!c) return { ok: false, error: t.common.error };
      recipient = { name: c.name, email: c.email, phone: c.phone, telegramChatId: c.telegramChatId };
    } else {
      recipient = { name: str(form, 'recipientName').slice(0, 120) || '—', email: optStr(form, 'recipientEmail'), phone: optStr(form, 'recipientPhone'), telegramChatId: null };
    }

    const results = await shareDocuments({
      tenantId: s.tenant.id,
      tenantName: s.tenant.name,
      settings: s.settings,
      docs,
      recipient,
      channels,
      mode,
      expiresInHours: hours,
      note: str(form, 'note').slice(0, 1000),
      createdBy: s.user.id,
    });
    await audit({
      tenantId: s.tenant.id,
      userId: s.user.id,
      action: 'document.shared',
      entityType: 'document',
      entityId: docs.length === 1 ? docs[0].id : undefined,
      summary: `مشاركة ${docs.map((d) => `«${d.title}»`).join('، ')} مع ${recipient.name} عبر ${channels.join('/')} (${mode === 'link' ? `رابط ${hours} ساعة` : 'مرفقات'})`,
      metadata: { results: results.map((r) => ({ channel: r.channel, ok: r.ok, error: r.error })) },
    });
    revalidatePath('/app/documents');
    const failed = results.filter((r) => !r.ok);
    return {
      ok: true,
      message: failed.length ? failed.map((r) => f(t.documents.channelFailed, { channel: r.channel, error: r.error ?? '' })).join(' · ') : t.documents.sent,
      data: { results },
    };
  });
}

export async function createBundle(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('documents:write');
    const { t } = await getI18n();
    const name = str(form, 'name').slice(0, 120);
    const ids = form.getAll('documentIds').map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
    if (name.length < 2 || !ids.length) return { ok: false, error: `${t.documents.bundleName}: ${t.common.required}` };
    const docs = await db.select({ id: documents.id }).from(documents).where(and(eq(documents.tenantId, s.tenant.id), inArray(documents.id, ids)));
    const [b] = await db.insert(documentBundles).values({ tenantId: s.tenant.id, name, description: optStr(form, 'description'), createdBy: s.user.id }).returning();
    if (docs.length) await db.insert(documentBundleItems).values(docs.map((d) => ({ bundleId: b.id, documentId: d.id })));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'bundle.created', entityType: 'bundle', entityId: b.id, summary: `إنشاء حقيبة «${name}» (${docs.length} مستندات)` });
    revalidatePath('/app/documents');
    return { ok: true, message: t.common.saved };
  });
}

export async function deleteBundle(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('documents:write');
    const { t } = await getI18n();
    const [b] = await db.delete(documentBundles).where(and(eq(documentBundles.id, id), eq(documentBundles.tenantId, s.tenant.id))).returning();
    if (b) await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'bundle.deleted', entityType: 'bundle', entityId: id, summary: `حذف حقيبة «${b.name}»` });
    revalidatePath('/app/documents');
    return { ok: true, message: t.common.saved };
  });
}

export async function revokeShareLink(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const s = await requirePermission('documents:share');
    const { t } = await getI18n();
    await db.update(shareLinks).set({ revokedAt: new Date() }).where(and(eq(shareLinks.id, id), eq(shareLinks.tenantId, s.tenant.id)));
    await audit({ tenantId: s.tenant.id, userId: s.user.id, action: 'share_link.revoked', entityType: 'share_link', entityId: id, summary: 'إلغاء رابط مشاركة' });
    revalidatePath('/app/documents');
    return { ok: true, message: t.common.saved };
  });
}
