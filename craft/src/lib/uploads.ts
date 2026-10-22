import { and, eq, lt } from 'drizzle-orm';
import { db, type DbOrTx } from '@/db';
import { uploads } from '@/db/schema';
import { consume, HOUR } from '@/lib/auth/rate-limit';
import { randomToken, sha256 } from '@/lib/crypto';
import { ApiError } from '@/lib/http';
import { ALLOWED_BY_PURPOSE, MAX_UPLOAD_BYTES, sameFamily, sniffMime, type UploadPurpose } from '@/lib/sniff';
import { storage } from '@/lib/storage';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

export interface SignRequest {
  mime: string;
  bytes: number;
  /** Hex SHA-256 of the file, computed in the browser. */
  sha256: string;
}

export interface SignedUpload {
  uploadId: string;
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * Serverless hosts cap request bodies (4.5 MB on Vercel). Direct-to-bucket uploads are not affected;
 * uploads that go through the app (database and local drivers) must stay under the cap.
 */
function uploadLimit(): number {
  if (storage().presignPut || !process.env.VERCEL) return MAX_UPLOAD_BYTES;
  return Math.min(MAX_UPLOAD_BYTES, 4_400_000);
}

/** Step 1: reserve a key and hand back where to PUT the bytes. */
export async function signUpload(userId: string, purpose: UploadPurpose, req: SignRequest): Promise<SignedUpload> {
  const allowed = ALLOWED_BY_PURPOSE[purpose] as readonly string[];
  const mime = req.mime === 'image/heif' ? 'image/heic' : req.mime;
  if (!allowed.includes(mime)) throw new ApiError('upload_type');
  if (req.bytes <= 0 || req.bytes > uploadLimit()) throw new ApiError('upload_too_large');
  if (!/^[a-f0-9]{64}$/.test(req.sha256)) throw new ApiError('validation');
  if (!(await consume([{ key: `upload:${userId}`, limit: 120, windowMs: HOUR }]))) throw new ApiError('rate_limited');

  const now = new Date();
  const key = `${purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomToken(18)}.${EXT[mime] ?? 'bin'}`;
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  const [row] = await db
    .insert(uploads)
    .values({ userId, purpose, storageKey: key, mime, bytes: req.bytes, sha256: req.sha256, expiresAt })
    .returning({ id: uploads.id });

  const driver = storage();
  if (driver.presignPut) {
    const signed = await driver.presignPut(key, mime, req.bytes, Buffer.from(req.sha256, 'hex').toString('base64'));
    return { uploadId: row.id, method: 'PUT', url: signed.url, headers: signed.headers, expiresAt: expiresAt.toISOString() };
  }
  return { uploadId: row.id, method: 'PUT', url: `/api/v1/uploads/${row.id}`, headers: { 'content-type': mime }, expiresAt: expiresAt.toISOString() };
}

/** Step 2 (database and local drivers): receive the bytes and check them against what was signed. */
export async function receiveUpload(userId: string, uploadId: string, body: Buffer) {
  const [u] = await db.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId)));
  if (!u) throw new ApiError('not_found');
  if (u.status !== 'pending') throw new ApiError('invalid_state');
  if (u.expiresAt < new Date()) throw new ApiError('upload_expired');
  if (body.length !== u.bytes || sha256(body) !== u.sha256) throw new ApiError('upload_mismatch');
  const sniffed = sniffMime(body.subarray(0, 32));
  if (!sniffed || !sameFamily(u.mime, sniffed)) throw new ApiError('upload_type');
  await storage().put(u.storageKey, body, u.mime);
  await db.update(uploads).set({ status: 'uploaded' }).where(eq(uploads.id, u.id));
}

export interface ClaimedUpload {
  key: string;
  mime: string;
  bytes: number;
  sha256: string;
}

/**
 * Step 3: attach an upload to a record. For direct-to-bucket uploads this is the first time the
 * server sees the object, so it confirms the size and sniffs the first bytes.
 */
export async function claimUpload(userId: string, uploadId: string, purpose: UploadPurpose, tx: DbOrTx = db): Promise<ClaimedUpload> {
  const [u] = await tx.select().from(uploads).where(and(eq(uploads.id, uploadId), eq(uploads.userId, userId), eq(uploads.purpose, purpose)));
  if (!u) throw new ApiError('not_found');
  if (u.status === 'attached') throw new ApiError('invalid_state');
  if (u.status === 'pending') {
    const driver = storage();
    if (!driver.presignPut) throw new ApiError('upload_missing');
    const head = await driver.head(u.storageKey);
    if (!head) throw new ApiError('upload_missing');
    if (head.bytes !== u.bytes) throw new ApiError('upload_mismatch');
    const first = await driver.readHead(u.storageKey, 32);
    const sniffed = first ? sniffMime(first) : null;
    if (!sniffed || !sameFamily(u.mime, sniffed)) {
      await driver.delete(u.storageKey);
      throw new ApiError('upload_type');
    }
  }
  await tx.update(uploads).set({ status: 'attached' }).where(eq(uploads.id, u.id));
  return { key: u.storageKey, mime: u.mime, bytes: u.bytes, sha256: u.sha256 };
}

/** Deletes uploads that were never attached (abandoned forms, failed submissions). */
export async function sweepUploads(): Promise<number> {
  const stale = await db.select({ id: uploads.id, key: uploads.storageKey }).from(uploads).where(and(lt(uploads.expiresAt, new Date(Date.now() - HOUR)), eq(uploads.status, 'pending')));
  const staleUploaded = await db
    .select({ id: uploads.id, key: uploads.storageKey })
    .from(uploads)
    .where(and(lt(uploads.expiresAt, new Date(Date.now() - 24 * HOUR)), eq(uploads.status, 'uploaded')));
  for (const u of [...stale, ...staleUploaded]) {
    await storage()
      .delete(u.key)
      .catch(() => undefined);
    await db.delete(uploads).where(eq(uploads.id, u.id));
  }
  return stale.length + staleUploaded.length;
}
