'use client';

/** Browser-side media processing: resize and re-encode before upload, so the server needs no image pipeline. */

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error('Encoding failed');
  return blob;
}

/** WebP where the browser can encode it (Safari can't everywhere), JPEG otherwise. */
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  return webp.type === 'image/webp' ? webp : canvasToBlob(canvas, 'image/jpeg', quality);
}

function drawScaled(source: CanvasImageSource, w: number, h: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export interface ProcessedImage {
  full: Blob;
  thumb: Blob;
  lqip: string;
  width: number;
  height: number;
}

/** Full image (longest side 3,840 px, 4K), a 720 px thumbnail and a ~1 KB blurred placeholder. */
export async function processImage(file: Blob, maxSide = 3840): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const fullCanvas = drawScaled(bitmap, bitmap.width, bitmap.height, maxSide);
  let full = await encode(fullCanvas, 0.86);
  // Stay under the 5 MB limit even for very detailed photos.
  for (let q = 0.78; full.size > 4.8 * 1024 * 1024 && q > 0.4; q -= 0.12) full = await encode(fullCanvas, q);
  const thumb = await encode(drawScaled(bitmap, bitmap.width, bitmap.height, 720), 0.8);
  const tiny = drawScaled(bitmap, bitmap.width, bitmap.height, 24);
  const lqip = tiny.toDataURL('image/webp', 0.5).startsWith('data:image/webp') ? tiny.toDataURL('image/webp', 0.5) : tiny.toDataURL('image/jpeg', 0.5);
  bitmap.close();
  return { full, thumb, lqip, width: fullCanvas.width, height: fullCanvas.height };
}

/** Invoice photos: enough resolution to read every digit, small enough to upload on 4G. */
export async function processInvoicePhoto(source: Blob | HTMLCanvasElement): Promise<Blob> {
  if (source instanceof HTMLCanvasElement) return encode(drawScaled(source, source.width, source.height, 2400), 0.88);
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  const canvas = drawScaled(bitmap, bitmap.width, bitmap.height, 2400);
  bitmap.close();
  const blob = await encode(canvas, 0.88);
  // The AI reader accepts JPEG, PNG and WebP; HEIC never leaves the phone.
  return blob;
}

export interface VideoInfo {
  poster: Blob;
  width: number;
  height: number;
  duration: number;
}

/** First meaningful frame of a video as a poster image, plus its size and duration. */
export function videoPoster(file: Blob): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
    };
    v.onseeked = async () => {
      try {
        const canvas = drawScaled(v, v.videoWidth, v.videoHeight, 1280);
        resolve({ poster: await encode(canvas, 0.82), width: v.videoWidth, height: v.videoHeight, duration: v.duration });
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unsupported video'));
    };
  });
}

/** Reads QR codes from a canvas: the native BarcodeDetector when present, jsQR otherwise. */
export async function detectQr(canvas: HTMLCanvasElement): Promise<string | null> {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (BD) {
    try {
      const codes = await new BD({ formats: ['qr_code'] }).detect(canvas);
      if (codes[0]?.rawValue) return codes[0].rawValue;
    } catch {
      // Fall through to jsQR.
    }
  }
  const { default: jsQR } = await import('jsqr');
  const scaled = drawScaled(canvas, canvas.width, canvas.height, 1200);
  const ctx = scaled.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, scaled.width, scaled.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

export async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const canvas = drawScaled(bitmap, bitmap.width, bitmap.height, 2400);
  bitmap.close();
  return canvas;
}

/** Client-side preview of a ZATCA QR (seller, VAT number, total). The server re-validates everything. */
export function previewZatca(payload: string): { seller: string; vat: string; total: string; time: string } | null {
  try {
    const bin = atob(payload.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const fields: Record<number, string> = {};
    for (let i = 0; i + 2 <= bytes.length; ) {
      const tag = bytes[i];
      const len = bytes[i + 1];
      if (tag <= 5) fields[tag] = new TextDecoder().decode(bytes.subarray(i + 2, i + 2 + len));
      i += 2 + len;
    }
    return fields[1] && fields[2] ? { seller: fields[1], vat: fields[2], total: fields[4] ?? '', time: fields[3] ?? '' } : null;
  } catch {
    return null;
  }
}
