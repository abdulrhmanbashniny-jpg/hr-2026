'use client';

import { ImagePlus, LoaderCircle, MapPin, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Switch } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError, uploadFile } from '@/lib/api-client';
import { processImage, videoPoster } from '@/lib/media/client';
import { useI18n } from '@/lib/i18n/client';

type Role = 'before' | 'after' | 'gallery';

export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  role: Role;
  url: string | null;
  thumbUrl: string | null;
  posterUrl: string | null;
  lqip: string | null;
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * One work = one main file (photo or video) plus an optional "before" photo for the comparison
 * slider. Each slot uploads straight to storage after compressing in the browser.
 */
export function MediaManager({ projectId, initial }: { projectId: string; initial: MediaItem[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [busy, setBusy] = useState<{ slot: 'main' | 'before'; stage: string; pct: number } | null>(null);
  const [geo, setGeo] = useState(false);
  const main = items.find((m) => m.role !== 'before') ?? null;
  const before = items.find((m) => m.role === 'before') ?? null;

  async function position(): Promise<{ lat: number; lng: number } | null> {
    if (!geo || !navigator.geolocation) return null;
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 8000 }));
  }

  async function upload(slot: 'main' | 'before', file: File | undefined) {
    if (!file) return;
    const current = slot === 'main' ? main : before;
    const update = (stage: string, pct = 0) => setBusy({ slot, stage, pct });
    try {
      const isVideo = file.type.startsWith('video/');
      if (slot === 'before' && isVideo) throw new Error(t.errors.upload_type);
      const coords = await position();
      let body: Record<string, unknown>;
      if (isVideo) {
        if (file.size > MAX_BYTES) throw new Error(t.portfolio.media.tooLarge);
        update(t.portfolio.media.compressing);
        const info = await videoPoster(file);
        const uploadId = await uploadFile('/portfolio/upload', file, (p) => update(t.portfolio.media.uploading, p));
        const posterUploadId = await uploadFile('/portfolio/upload', info.poster);
        body = { uploadId, posterUploadId, width: info.width, height: info.height, durationSec: info.duration || null };
      } else {
        update(t.portfolio.media.compressing);
        const img = await processImage(file);
        const uploadId = await uploadFile('/portfolio/upload', img.full, (p) => update(t.portfolio.media.uploading, p));
        const thumbUploadId = await uploadFile('/portfolio/upload', img.thumb);
        body = { uploadId, thumbUploadId, width: img.width, height: img.height, lqip: img.lqip };
      }
      // Replacing: the slot holds one file, so the old one goes first.
      if (current) await api(`/portfolio/media/${current.id}`, { method: 'DELETE', body: {} });
      const created = await api<MediaItem>(`/portfolio/projects/${projectId}/media`, {
        body: { ...body, role: slot === 'before' ? 'before' : 'after', capturedAt: new Date(file.lastModified).toISOString(), geo: coords },
      });
      setItems((xs) => [...xs.filter((m) => m.id !== current?.id), created]);
      navigator.vibrate?.(10);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : t.errors.generic, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: MediaItem) {
    setItems((xs) => xs.filter((x) => x.id !== m.id));
    await api(`/portfolio/media/${m.id}`, { method: 'DELETE', body: {} }).catch(() => toast(t.errors.generic, 'error'));
    router.refresh();
  }

  const slot = (kind: 'main' | 'before') => {
    const m = kind === 'main' ? main : before;
    const loading = busy?.slot === kind;
    const accept = kind === 'main' ? 'image/*,video/mp4,video/quicktime,video/webm' : 'image/*';
    return (
      <div className="flex flex-col gap-space-xs">
        <div>
          <div className="text-label-lg text-primary">{kind === 'main' ? t.portfolio.media.main : t.portfolio.media.before}</div>
          <div className="text-body-sm text-on-surface-variant">{kind === 'main' ? t.portfolio.media.mainHint : t.portfolio.media.beforeHint}</div>
        </div>
        {m && !loading ? (
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-container">
            <img src={(m.kind === 'video' ? m.posterUrl : (m.thumbUrl ?? m.url)) ?? undefined} alt="" className="aspect-[4/3] w-full object-cover" style={m.lqip ? { backgroundImage: `url("${m.lqip}")`, backgroundSize: 'cover' } : undefined} />
            {m.kind === 'video' && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="amber-gradient grid size-14 place-items-center rounded-full shadow-lg">
                  <Play className="size-6 fill-primary-container text-primary-container" />
                </span>
              </span>
            )}
            <div className="absolute inset-x-2 bottom-2 flex justify-between gap-2">
              <label className="press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-surface-container-lowest/95 px-3 text-label-md text-primary-container shadow-sm backdrop-blur">
                <RefreshCw className="size-4" />
                {t.portfolio.media.replace}
                <input type="file" accept={accept} hidden onChange={(e) => (upload(kind, e.target.files?.[0]), (e.target.value = ''))} />
              </label>
              <button type="button" onClick={() => remove(m)} aria-label={t.portfolio.media.remove} className="press grid size-9 place-items-center rounded-lg bg-surface-container-lowest/95 text-[#EF4444] shadow-sm backdrop-blur hover:bg-error-container">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <label className={`press flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-space-sm rounded-2xl border-2 border-dashed border-line-strong bg-surface-container-low text-center text-body-sm text-on-surface-variant transition hover:border-accent-2 hover:bg-secondary-fixed/20 ${loading ? 'pointer-events-none' : ''}`}>
            {loading ? (
              <>
                <LoaderCircle className="size-8 animate-spin text-secondary" />
                {busy?.stage}
                {!!busy?.pct && <span className="num">{busy.pct}%</span>}
              </>
            ) : (
              <>
                <span className="grid size-14 place-items-center rounded-full bg-secondary-fixed/50 text-secondary">
                  <ImagePlus className="size-7" />
                </span>
                <span className="text-label-lg text-primary">{kind === 'main' ? t.portfolio.media.add : t.portfolio.media.addBefore}</span>
              </>
            )}
            <input type="file" accept={accept} hidden disabled={loading} onChange={(e) => (upload(kind, e.target.files?.[0]), (e.target.value = ''))} />
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-space-md">
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
        {slot('main')}
        {slot('before')}
      </div>
      <Switch
        checked={geo}
        onChange={setGeo}
        label={
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4 text-muted" />
            {t.portfolio.media.geo}
          </span>
        }
      />
    </div>
  );
}
