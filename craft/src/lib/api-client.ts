'use client';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Calls /api/v1 and unwraps the `{ data }` / `{ error }` envelope. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path.startsWith('/api/') ? path : `/api/v1${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
    credentials: 'same-origin',
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; details?: unknown } } | null;
  if (!res.ok || !json || json.error) throw new ApiClientError(json?.error?.code ?? 'generic', json?.error?.message ?? res.statusText, res.status, json?.error?.details);
  return json.data as T;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signs, then PUTs the bytes (to the bucket or to our server), and returns the upload id. */
export async function uploadFile(signPath: string, file: Blob, onProgress?: (pct: number) => void): Promise<string> {
  const signed = await api<{ uploadId: string; url: string; headers: Record<string, string> }>(signPath, {
    body: { mime: file.type, bytes: file.size, sha256: await sha256Hex(file) },
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signed.url);
    for (const [k, v] of Object.entries(signed.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      try {
        const j = JSON.parse(xhr.responseText) as { error?: { code: string; message: string } };
        reject(new ApiClientError(j.error?.code ?? 'upload_failed', j.error?.message ?? 'Upload failed', xhr.status));
      } catch {
        reject(new ApiClientError('upload_failed', 'Upload failed', xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiClientError('network', 'Network error', 0));
    xhr.send(file);
  });
  return signed.uploadId;
}

/** A light, non-invasive device hint for fraud checks (no canvas or audio fingerprinting). */
export function deviceHint(): string {
  try {
    return [navigator.userAgent, screen.width, screen.height, devicePixelRatio, Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language, navigator.hardwareConcurrency].join('|').slice(0, 200);
  } catch {
    return '';
  }
}
