import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

/**
 * Storage for document-hub attachments only. Government Excel uploads never reach this module: they
 * are parsed in memory and discarded.
 */
export interface StorageDriver {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

const KEY_PATTERN = /^[a-f0-9-]{36}\/[a-f0-9-]{36}$/;

function assertKey(key: string) {
  if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
}

class LocalDriver implements StorageDriver {
  private root = path.resolve(env.storage.localDir);
  private file(key: string) {
    assertKey(key);
    return path.join(this.root, key);
  }
  async put(key: string, body: Uint8Array) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.file(key)));
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

class S3Driver implements StorageDriver {
  private client = new S3Client({
    region: env.storage.s3Region,
    endpoint: env.storage.s3Endpoint,
    forcePathStyle: !!env.storage.s3Endpoint,
    credentials: { accessKeyId: env.storage.s3AccessKeyId, secretAccessKey: env.storage.s3SecretAccessKey },
  });
  async put(key: string, body: Uint8Array, contentType: string) {
    assertKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: env.storage.s3Bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: env.storage.s3Endpoint ? undefined : 'AES256' }));
  }
  async get(key: string) {
    assertKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
    if (!res.Body) throw new Error('Empty object');
    return await res.Body.transformToByteArray();
  }
  async remove(key: string) {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  driver ??= env.storage.driver === 's3' ? new S3Driver() : new LocalDriver();
  return driver;
}

export const ALLOWED_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
};
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
