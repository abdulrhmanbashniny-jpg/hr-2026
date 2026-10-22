import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { craftsmen, verificationDocuments } from '@/db/schema';
import { audit } from '@/lib/audit';
import { encryptSecret } from '@/lib/crypto';
import { digitsOnly } from '@/lib/digits';
import { ApiError } from '@/lib/http';
import { isValidSaudiId } from '@/lib/ids';
import { notify } from '@/lib/notifications';
import { claimUpload } from '@/lib/uploads';
import { invalidateProfile } from './service';

export type VerificationInput =
  | { kind: 'national_id'; uploadId: string; nationalId: string }
  | { kind: 'freelance_license'; uploadId: string; licenseNumber: string; expiresOn: string };

export async function submitVerification(userId: string, craftsmanId: string, input: VerificationInput) {
  if (input.kind === 'national_id' && !isValidSaudiId(input.nationalId)) throw new ApiError('invalid_national_id');
  await db.transaction(async (tx) => {
    // One open request per kind: a second submission while the first is under review would let an
    // approval of the old document stand for the new number (or the reverse).
    await tx.select({ id: craftsmen.id }).from(craftsmen).where(eq(craftsmen.id, craftsmanId)).for('update');
    const [open] = await tx
      .select({ id: verificationDocuments.id })
      .from(verificationDocuments)
      .where(and(eq(verificationDocuments.craftsmanId, craftsmanId), eq(verificationDocuments.kind, input.kind), eq(verificationDocuments.status, 'pending')));
    if (open) throw new ApiError('already_pending', 409);
    const file = await claimUpload(userId, input.uploadId, 'document', tx);
    await tx.insert(verificationDocuments).values({ craftsmanId, kind: input.kind, storageKey: file.key, mime: file.mime });
    if (input.kind === 'national_id') {
      const id = digitsOnly(input.nationalId);
      await tx.update(craftsmen).set({ identityStatus: 'pending', nationalIdEnc: encryptSecret(id), nationalIdLast4: id.slice(-4), updatedAt: new Date() }).where(eq(craftsmen.id, craftsmanId));
    } else {
      await tx
        .update(craftsmen)
        .set({ licenseStatus: 'pending', licenseNumber: input.licenseNumber.trim(), licenseExpiresOn: input.expiresOn, updatedAt: new Date() })
        .where(eq(craftsmen.id, craftsmanId));
    }
  });
}

/**
 * Staff decision on a document. The craftsman's identity or licence status follows it only when it
 * is the newest document of its kind, so deciding on an older copy never overrides the current one.
 */
export async function reviewDocument(documentId: string, actorId: string, approve: boolean, note?: string | null) {
  const status = approve ? 'verified' : 'rejected';
  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .update(verificationDocuments)
      .set({ status, reviewedBy: actorId, reviewedAt: new Date(), note: note ?? null })
      .where(and(eq(verificationDocuments.id, documentId), eq(verificationDocuments.status, 'pending')))
      .returning();
    if (!doc) throw new ApiError('invalid_state');
    const [owner] = await tx.select({ userId: craftsmen.userId }).from(craftsmen).where(eq(craftsmen.id, doc.craftsmanId)).for('update');
    if (owner?.userId === actorId) throw new ApiError('self_review', 403);
    const [latest] = await tx
      .select({ id: verificationDocuments.id })
      .from(verificationDocuments)
      .where(and(eq(verificationDocuments.craftsmanId, doc.craftsmanId), eq(verificationDocuments.kind, doc.kind)))
      .orderBy(desc(verificationDocuments.createdAt))
      .limit(1);
    const current = latest?.id === doc.id;
    const [c] = current
      ? await tx
          .update(craftsmen)
          .set(doc.kind === 'national_id' ? { identityStatus: status } : doc.kind === 'freelance_license' ? { licenseStatus: status } : {})
          .where(eq(craftsmen.id, doc.craftsmanId))
          .returning({ userId: craftsmen.userId, code: craftsmen.referralCode })
      : [];
    await audit(actorId, approve ? 'verification.approve' : 'verification.reject', { type: 'verification_document', id: documentId }, { kind: doc.kind, note, superseded: !current }, tx);
    return { doc, c };
  });
  const { doc, c } = result;
  if (c) {
    invalidateProfile(c.code);
    await notify(c.userId, 'verification', (t) => ({ item: doc.kind === 'national_id' ? t.profileEdit.nationalId : t.profileEdit.license, status: t.profileEdit.statuses[status] }), '/app/profile');
  }
}
