import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { DocumentsHub, type DocumentVM } from '@/components/documents/documents-hub';
import { PageHead } from '@/components/ui/card';
import { ExpiryMatrix } from '@/components/ui/matrix';
import { db } from '@/db';
import { authorities, contacts, documentBundleItems, documentBundles, documents, shareLinks } from '@/db/schema';
import { matrixOf } from '@/lib/analytics/common';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { bucketFor, todayRiyadh } from '@/lib/dates';
import { getI18n } from '@/lib/i18n';
import { emailEnabled } from '@/lib/notifications/email';
import { telegramEnabled } from '@/lib/notifications/telegram';
import { whatsappAutomatic } from '@/lib/notifications/whatsapp';
import { MAX_DOCUMENT_MB } from '@/lib/storage';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.documents.title };
}

export default async function DocumentsPage(props: PageProps<'/app/documents'>) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const sp = await props.searchParams;
  const today = todayRiyadh();
  const tid = s.tenant.id;
  const [docs, auths, people, bundles, links] = await Promise.all([
    db.select().from(documents).where(eq(documents.tenantId, tid)).orderBy(documents.expiryDate),
    db.select().from(authorities).where(or(isNull(authorities.tenantId), eq(authorities.tenantId, tid))),
    db.select().from(contacts).where(and(eq(contacts.tenantId, tid), eq(contacts.isActive, true))),
    db.select().from(documentBundles).where(eq(documentBundles.tenantId, tid)).orderBy(desc(documentBundles.createdAt)),
    db.select().from(shareLinks).where(and(eq(shareLinks.tenantId, tid), isNull(shareLinks.revokedAt), or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date())))).orderBy(desc(shareLinks.createdAt)),
  ]);
  const items = bundles.length ? await db.select().from(documentBundleItems).where(inArray(documentBundleItems.bundleId, bundles.map((b) => b.id))) : [];
  const authById = new Map(auths.map((a) => [a.id, a]));
  const contactById = new Map(people.map((c) => [c.id, c]));
  const docTitle = new Map(docs.map((d) => [d.id, d.title]));
  const bucket = typeof sp.bucket === 'string' ? sp.bucket : null;
  const vm: DocumentVM[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    authorityId: d.authorityId,
    authority: d.authorityId ? (locale === 'ar' ? authById.get(d.authorityId)?.nameAr : authById.get(d.authorityId)?.nameEn) ?? null : null,
    referenceNumber: d.referenceNumber,
    issueDate: d.issueDate,
    expiryDate: d.expiryDate,
    expiryDateHijri: d.expiryDateHijri,
    alertDays: d.alertDays,
    responsibleContactId: d.responsibleContactId,
    responsible: d.responsibleContactId ? (contactById.get(d.responsibleContactId)?.name ?? null) : null,
    renewalFee: d.renewalFee,
    hasFile: !!d.fileKey,
    fileName: d.fileName,
    externalUrl: d.externalUrl,
    notes: d.notes,
    status: d.status,
    bucket: bucketFor(d.expiryDate, today),
  }));
  const live = docs.filter((d) => d.status !== 'archived');
  return (
    <>
      <PageHead title={t.documents.title} sub={t.documents.subtitle} />
      <ExpiryMatrix title={t.dashboard.documents} matrix={matrixOf(live.map((d) => d.expiryDate), today)} t={t} hrefFor={(b) => `/app/documents?bucket=${b}`} active={bucket} />
      <DocumentsHub
        docs={vm}
        today={today}
        initialBucket={bucket}
        openDocId={typeof sp.doc === 'string' ? sp.doc : null}
        authorities={auths.map((a) => ({ id: a.id, name: locale === 'ar' ? a.nameAr : a.nameEn }))}
        contacts={people.map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, telegram: !!c.telegramChatId }))}
        bundles={bundles.map((b) => ({ id: b.id, name: b.name, description: b.description, documentIds: items.filter((i) => i.bundleId === b.id).map((i) => i.documentId) }))}
        links={links.map((l) => ({ id: l.id, recipient: l.recipient, channel: l.channel, expiresAt: l.expiresAt?.toISOString() ?? null, accessCount: l.accessCount, titles: l.documentIds.map((id) => docTitle.get(id) ?? '—') }))}
        canWrite={can(s.role, 'documents:write') && (s.subscription?.canWrite ?? true)}
        canShare={can(s.role, 'documents:share') && (s.subscription?.canWrite ?? true)}
        channels={{ email: await emailEnabled(s.settings), telegram: telegramEnabled(s.settings, s.tenant.id), whatsappAuto: whatsappAutomatic(s.settings) }}
        maxFileMb={MAX_DOCUMENT_MB}
      />
    </>
  );
}
