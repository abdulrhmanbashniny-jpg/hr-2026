import { and, eq } from 'drizzle-orm';
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

/** Staff decision on a document; the craftsman's identity or licence status follows it. */
export async function reviewDocument(documentId: string, actorId: string, approve: boolean, note?: string | null) {
  const [doc] = await db
    .update(verificationDocuments)
    .set({ status: approve ? 'verified' : 'rejected', reviewedBy: actorId, reviewedAt: new Date(), note: note ?? null })
    .where(and(eq(verificationDocuments.id, documentId), eq(verificationDocuments.status, 'pending')))
    .returning();
  if (!doc) throw new ApiError('invalid_state');
  const status = approve ? 'verified' : 'rejected';
  const [c] = await db
    .update(craftsmen)
    .set(doc.kind === 'national_id' ? { identityStatus: status } : doc.kind === 'freelance_license' ? { licenseStatus: status } : {})
    .where(eq(craftsmen.id, doc.craftsmanId))
    .returning({ userId: craftsmen.userId, code: craftsmen.referralCode });
  await audit(actorId, approve ? 'verification.approve' : 'verification.reject', { type: 'verification_document', id: documentId }, { kind: doc.kind, note });
  if (c) {
    invalidateProfile(c.code);
    await notify(c.userId, 'verification', (t) => ({ item: doc.kind === 'national_id' ? t.profileEdit.nationalId : t.profileEdit.license, status: t.profileEdit.statuses[status] }), '/app/profile');
  }
}
