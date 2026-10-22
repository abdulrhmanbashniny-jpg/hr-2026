'use client';

import { ImagePlus, LoaderCircle, MapPin, Play, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Switch } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError, uploadFile } from '@/lib/api-client';
import { cn } from '@/lib/cn';
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

const MAX = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export function MediaManager({ projectId, initial }: { projectId: string; initial: MediaItem[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [busy, setBusy] = useState<{ name: string; stage: string; pct: number }[]>([]);
  const [geo, setGeo] = useState(false);

  function nextRole(list: MediaItem[]): Role {
    if (!list.some((m) => m.role === 'before')) return 'before';
    if (!list.some((m) => m.role === 'after')) return 'after';
    return 'gallery';
  }

  async function position(): Promise<{ lat: number; lng: number } | null> {
    if (!geo || !navigator.geolocation) return null;
    return new Promise((resolve) => navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 8000 }));
  }

  async function add(files: FileList | null) {
    if (!files?.length) return;
    let list = items;
    const room = MAX - list.length - busy.length;
    if (room <= 0) return toast(t.portfolio.media.limit, 'error');
    const coords = await position();
    for (const file of [...files].slice(0, room)) {
      const label = file.name;
      const update = (stage: string, pct = 0) => setBusy((b) => [...b.filter((x) => x.name !== label), { name: label, stage, pct }]);
      try {
        const isVideo = file.type.startsWith('video/');
        let body: Record<string, unknown>;
        if (isVideo) {
          if (file.size > MAX_BYTES) throw new Error(t.portfolio.media.tooLarge);
          update(t.portfolio.media.compressing);
          const info = await videoPoster(file);
          update(t.portfolio.media.uploading);
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
        const role = nextRole(list);
        const created = await api<MediaItem>(`/portfolio/projects/${projectId}/media`, {
          body: { ...body, role, capturedAt: new Date(file.lastModified).toISOString(), geo: coords },
        });
        list = [...list, created];
        setItems(list);
      } catch (e) {
        toast(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : t.errors.generic, 'error');
      } finally {
        setBusy((b) => b.filter((x) => x.name !== label));
      }
    }
    router.refresh();
  }

  async function setRole(id: string, role: Role) {
    setItems((xs) => xs.map((m) => (m.id === id ? { ...m, role } : m)));
    await api(`/portfolio/media/${id}`, { method: 'PATCH', body: { role } }).catch(() => toast(t.errors.generic, 'error'));
  }

  async function remove(id: string) {
    setItems((xs) => xs.filter((m) => m.id !== id));
    await api(`/portfolio/media/${id}`, { method: 'DELETE', body: {} }).catch(() => toast(t.errors.generic, 'error'));
    router.refresh();
  }

  const full = items.length + busy.length >= MAX;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnimatePresence initial={false}>
          {items.map((m) => (
            <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="overflow-hidden rounded-2xl border border-line bg-surface-container-lowest">
              <div className="relative aspect-square bg-surface-2">
                {(m.thumbUrl ?? m.posterUrl ?? m.url) && (
                  <img src={(m.kind === 'video' ? m.posterUrl : m.thumbUrl ?? m.url) ?? undefined} alt="" className="size-full object-cover" style={m.lqip ? { backgroundImage: `url(${m.lqip})`, backgroundSize: 'cover' } : undefined} />
                )}
                {m.kind === 'video' && (
                  <span className="absolute inset-0 grid place-items-center">
                    <Play className="size-8 fill-white text-white drop-shadow" />
                  </span>
                )}
                <button onClick={() => remove(m.id)} aria-label={t.portfolio.media.remove} className="press absolute top-2 end-2 grid size-8 place-items-center rounded-lg bg-navy-950/60 text-white backdrop-blur hover:bg-danger">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-0.5 p-1">
                {(['before', 'after', 'gallery'] as const).map((r) => (
                  <button key={r} onClick={() => setRole(m.id, r)} className={cn('rounded-lg py-1 text-[11px] font-medium transition', m.role === r ? 'bg-navy-900 text-white dark:bg-navy-200 dark:text-navy-950' : 'text-muted hover:bg-surface-2')}>
                    {t.portfolio.media.roles[r]}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
          {busy.map((b) => (
            <motion.div key={b.name} layout className="flex aspect-[1/1.15] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-3 text-center text-xs text-muted">
              <LoaderCircle className="size-6 animate-spin text-accent" />
              {b.stage}
              {b.pct > 0 && <span className="num">{b.pct}%</span>}
            </motion.div>
          ))}
        </AnimatePresence>
        {!full && (
          <label className="press flex aspect-[1/1.15] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong text-sm text-muted hover:border-accent hover:text-ink">
            <ImagePlus className="size-7" />
            {t.portfolio.media.add}
            <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          </label>
        )}
      </div>
      <p className="text-xs text-muted">{full ? t.portfolio.media.limit : t.portfolio.media.hint}</p>
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
