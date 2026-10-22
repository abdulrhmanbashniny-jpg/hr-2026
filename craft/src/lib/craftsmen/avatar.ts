import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { craftsmen } from '@/db/schema';
import { invalidateProfile } from '@/lib/craftsmen/service';
import { ApiError } from '@/lib/http';
import { mediaUrl, storage } from '@/lib/storage';
import { claimUpload } from '@/lib/uploads';

/** Puts a freshly uploaded photo on the card and public profile, and deletes the previous one. */
export async function setAvatar(userId: string, craftsmanId: string, code: string, uploadId: string) {
  const previous = await db.transaction(async (tx) => {
    const [row] = await tx.select({ key: craftsmen.avatarKey }).from(craftsmen).where(eq(craftsmen.id, craftsmanId)).for('update');
    if (!row) throw new ApiError('not_found');
    const file = await claimUpload(userId, uploadId, 'avatar', tx);
    if (!file.mime.startsWith('image/')) throw new ApiError('upload_type');
    await tx.update(craftsmen).set({ avatarKey: file.key, updatedAt: new Date() }).where(eq(craftsmen.id, craftsmanId));
    return { old: row.key, key: file.key };
  });
  if (previous.old && previous.old !== previous.key) await storage().delete(previous.old).catch(() => undefined);
  invalidateProfile(code);
  return { avatarUrl: mediaUrl(previous.key) };
}

/** Removes the photo. Used by the craftsman and by staff (who must give a reason in the audit log). */
export async function removeAvatar(craftsmanId: string) {
  const [row] = await db.select({ key: craftsmen.avatarKey, code: craftsmen.referralCode }).from(craftsmen).where(eq(craftsmen.id, craftsmanId));
  if (!row) throw new ApiError('not_found');
  if (!row.key) return { removed: false, code: row.code };
  await db.update(craftsmen).set({ avatarKey: null, updatedAt: new Date() }).where(eq(craftsmen.id, craftsmanId));
  await storage()
    .delete(row.key)
    .catch(() => undefined);
  invalidateProfile(row.code);
  return { removed: true, code: row.code };
}
