import { mkdir, readFile, rm, stat, writeFile, open } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { storedFiles } from '@/db/schema';
import { env } from '@/lib/env';

export interface StoredObject {
  body: Buffer;
  mime: string;
}

export interface StorageDriver {
  readonly name: 'database' | 's3' | 'local';
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<{ bytes: number; mime: string } | null>;
  /** First bytes of an object, to sniff its real type without downloading it. */
  readHead(key: string, bytes: number): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  /** Direct browser upload; only object storage supports it. */
  presignPut?(key: string, mime: string, bytes: number, sha256Base64: string): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet?(key: string, seconds: number): Promise<string>;
}

const databaseDriver: StorageDriver = {
  name: 'database',
  async put(key, body, mime) {
    await db.insert(storedFiles).values({ key, mime, bytes: body.length, data: body }).onConflictDoUpdate({ target: storedFiles.key, set: { mime, bytes: body.length, data: body } });
  },
  async get(key) {
    const [row] = await db.select({ data: storedFiles.data, mime: storedFiles.mime }).from(storedFiles).where(eq(storedFiles.key, key));
    return row ? { body: row.data, mime: row.mime } : null;
  },
  async head(key) {
    const [row] = await db.select({ bytes: storedFiles.bytes, mime: storedFiles.mime }).from(storedFiles).where(eq(storedFiles.key, key));
    return row ?? null;
  },
  async readHead(key, bytes) {
    const [row] = await db.select({ head: sql<Buffer>`substring(${storedFiles.data} from 1 for ${bytes})` }).from(storedFiles).where(eq(storedFiles.key, key));
    return row ? new Uint8Array(row.head) : null;
  },
  async delete(key) {
    await db.delete(storedFiles).where(eq(storedFiles.key, key));
  },
};

function localPath(key: string): string {
  const root = path.resolve(env.storage.localDir);
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
  return full;
}

const localDriver: StorageDriver = {
  name: 'local',
  async put(key, body, mime) {
    const p = localPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
    await writeFile(`${p}.mime`, mime);
  },
  async get(key) {
    try {
      const p = localPath(key);
      return { body: await readFile(p), mime: (await readFile(`${p}.mime`, 'utf8')).trim() };
    } catch {
      return null;
    }
  },
  async head(key) {
    try {
      const p = localPath(key);
      return { bytes: (await stat(p)).size, mime: (await readFile(`${p}.mime`, 'utf8')).trim() };
    } catch {
      return null;
    }
  },
  async readHead(key, bytes) {
    try {
      const fh = await open(localPath(key), 'r');
      const buf = Buffer.alloc(bytes);
      const { bytesRead } = await fh.read(buf, 0, bytes, 0);
      await fh.close();
      return new Uint8Array(buf.subarray(0, bytesRead));
    } catch {
      return null;
    }
  },
  async delete(key) {
    const p = localPath(key);
    await rm(p, { force: true });
    await rm(`${p}.mime`, { force: true });
  },
};

let s3: S3Client | null = null;
function s3Client(): S3Client {
  s3 ??= new S3Client({
    region: env.storage.s3Region,
    endpoint: env.storage.s3Endpoint,
    forcePathStyle: !!env.storage.s3Endpoint,
    credentials: { accessKeyId: env.storage.s3AccessKeyId, secretAccessKey: env.storage.s3SecretAccessKey },
  });
  return s3;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  const b = body as { transformToByteArray?: () => Promise<Uint8Array> };
  return Buffer.from(b.transformToByteArray ? await b.transformToByteArray() : new Uint8Array());
}

const s3Driver: StorageDriver = {
  name: 's3',
  async put(key, body, mime) {
    await s3Client().send(new PutObjectCommand({ Bucket: env.storage.s3Bucket, Key: key, Body: body, ContentType: mime }));
  },
  async get(key) {
    try {
      const r = await s3Client().send(new GetObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
      return { body: await bodyToBuffer(r.Body), mime: r.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  },
  async head(key) {
    try {
      const r = await s3Client().send(new HeadObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
      return { bytes: r.ContentLength ?? 0, mime: r.ContentType ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  },
  async readHead(key, bytes) {
    try {
      const r = await s3Client().send(new GetObjectCommand({ Bucket: env.storage.s3Bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
      return new Uint8Array(await bodyToBuffer(r.Body));
    } catch {
      return null;
    }
  },
  async delete(key) {
    await s3Client().send(new DeleteObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
  },
  /**
   * The signature covers the content type, the exact length and the SHA-256 checksum, so the bucket
   * itself refuses a different file, a bigger file or a corrupted one.
   */
  async presignPut(key, mime, bytes, sha256Base64) {
    const cmd = new PutObjectCommand({ Bucket: env.storage.s3Bucket, Key: key, ContentType: mime, ContentLength: bytes, ChecksumSHA256: sha256Base64 });
    const url = await getSignedUrl(s3Client(), cmd, {
      expiresIn: 900,
      signableHeaders: new Set(['content-type', 'content-length', 'x-amz-checksum-sha256']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
    });
    return { url, headers: { 'content-type': mime, 'x-amz-checksum-sha256': sha256Base64 } };
  },
  async presignGet(key, seconds) {
    return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }), { expiresIn: seconds });
  },
};

export function storage(): StorageDriver {
  switch (env.storage.driver) {
    case 's3':
      return s3Driver;
    case 'local':
      return localDriver;
    default:
      return databaseDriver;
  }
}

/** Public URL for portfolio media and avatars (never for invoices or identity documents). */
export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (env.storage.driver === 's3' && env.storage.publicBaseUrl) return `${env.storage.publicBaseUrl}/${key}`;
  return `/api/v1/media/${key}`;
}
