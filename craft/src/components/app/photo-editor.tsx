'use client';

import { Camera, ImagePlus, LoaderCircle, Trash2, ZoomIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError, uploadFile } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/client';

const VIEW = 280;
const OUT = 512;

/**
 * The card photo: pick from the gallery or the camera, frame it in a square (drag to move, slider to
 * zoom), and upload a 512 px WebP. The craftsman can also remove it; staff can remove it from the console.
 */
export function PhotoEditor({ name, photoUrl, compact = false }: { name: string; photoUrl: string | null; compact?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  function pick(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    image.src = url;
    setSrc(url);
  }

  // The image always covers the square: at zoom 1 its short side equals the frame.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : VIEW;
  const h = img ? img.naturalHeight * base * zoom : VIEW;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.min((w - VIEW) / 2, Math.max(-(w - VIEW) / 2, p.x)), y: Math.min((h - VIEW) / 2, Math.max(-(h - VIEW) / 2, p.y)) });
  const at = clamp(pos);

  async function save() {
    if (!img) return;
    setBusy('save');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext('2d')!;
      const k = OUT / VIEW;
      ctx.drawImage(img, (VIEW / 2 - w / 2 + at.x) * k, (VIEW / 2 - h / 2 + at.y) * k, w * k, h * k);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.88));
      const file = blob && blob.type === 'image/webp' ? blob : await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!file) throw new Error('encode');
      const uploadId = await uploadFile('/me/avatar/upload', file);
      await api('/me/avatar', { method: 'PUT', body: { uploadId } });
      toast(t.card.photoSaved);
      navigator.vibrate?.(10);
      setSrc(null);
      setImg(null);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      await api('/me/avatar', { method: 'DELETE' });
      toast(t.card.photoRemoved);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn('flex items-center gap-space-md', compact ? '' : 'rounded-2xl bg-surface-container-lowest p-space-md shadow-sm')}>
      <Avatar name={name} src={photoUrl} size={compact ? 64 : 88} className="rounded-2xl ring-2 ring-secondary/20" />
      <div className="min-w-0 flex-1">
        <div className="text-label-lg text-primary">{t.card.photo}</div>
        <p className="mt-0.5 text-body-sm text-on-surface-variant">{t.card.photoHint}</p>
        <div className="mt-space-sm flex flex-wrap gap-space-xs">
          <button type="button" onClick={() => input.current?.click()} className="press inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary-container px-space-md text-label-md text-white shadow-sm hover:bg-primary">
            {photoUrl ? <Camera className="size-4" /> : <ImagePlus className="size-4" />}
            {photoUrl ? t.card.changePhoto : t.card.addPhoto}
          </button>
          {photoUrl && (
            <button type="button" onClick={remove} disabled={!!busy} className="press inline-flex h-10 items-center gap-1.5 rounded-xl px-space-md text-label-md text-[#EF4444] hover:bg-[rgb(239_68_68/0.06)] disabled:opacity-50">
              {busy === 'remove' ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t.card.removePhoto}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <Dialog open={!!img} onClose={() => (busy ? undefined : (setImg(null), setSrc(null)))} title={t.card.photo}>
        {img && (
          <div className="flex flex-col items-center gap-space-md">
            <div
              className="relative touch-none overflow-hidden rounded-2xl bg-surface-container shadow-inner"
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
              }}
              onPointerUp={() => (drag.current = null)}
            >
              {src && <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: w, height: h, left: VIEW / 2 - w / 2 + at.x, top: VIEW / 2 - h / 2 + at.y }} />}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-secondary-container/80 ring-inset" />
            </div>
            <label className="flex w-full max-w-[280px] items-center gap-space-sm text-on-surface-variant">
              <ZoomIn className="size-5 shrink-0" />
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-[#102a43]" aria-label="zoom" />
            </label>
            <button type="button" onClick={save} disabled={!!busy} className="press amber-gradient inline-flex h-12 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl text-label-lg text-primary-container shadow-md disabled:opacity-60">
              {busy === 'save' ? <LoaderCircle className="size-5 animate-spin" /> : <Camera className="size-5" />}
              {photoUrl ? t.card.changePhoto : t.card.addPhoto}
            </button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
