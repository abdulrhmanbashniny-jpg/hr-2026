'use client';

import { ImagePlus, LoaderCircle, PaintBucket, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveBrandAction, saveProductAction, toggleProductAction } from '@/app/admin/actions';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Switch } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { uploadFile } from '@/lib/api-client';
import { processImage } from '@/lib/media/client';
import { useI18n } from '@/lib/i18n/client';
import { adminStrings } from '@/lib/i18n/pages/admin';
import type { BrandSettings } from '@/lib/products/service';

export interface ProductRow {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'interior' | 'exterior' | 'primer' | 'waterproofing' | 'decorative' | 'wood_metal';
  descriptionAr: string | null;
  descriptionEn: string | null;
  finishAr: string | null;
  finishEn: string | null;
  coverageSqmPerLiter: number | null;
  sizes: string[];
  swatch: string;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

const EMPTY: Omit<ProductRow, 'id' | 'imageUrl'> = { nameAr: '', nameEn: '', category: 'interior', descriptionAr: '', descriptionEn: '', finishAr: '', finishEn: '', coverageSqmPerLiter: 10, sizes: ['18 L'], swatch: '#E9DDC9', isActive: true, isFeatured: false, sortOrder: 0 };

export function BrandForm({ initial }: { initial: BrandSettings }) {
  const { locale } = useI18n();
  const s = adminStrings(locale).products;
  const toast = useToast();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof BrandSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="grid grid-cols-1 gap-space-md sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveBrandAction(v);
          if (r.ok) {
            toast(s.saved);
            router.refresh();
          } else toast(r.error, 'error');
        });
      }}
    >
      <Field label={s.factoryAr}>
        <Input value={v.factoryNameAr} onChange={set('factoryNameAr')} />
      </Field>
      <Field label={s.factoryEn}>
        <Input value={v.factoryNameEn} onChange={set('factoryNameEn')} dir="ltr" />
      </Field>
      <Field label={s.sloganAr}>
        <Input value={v.sloganAr} onChange={set('sloganAr')} />
      </Field>
      <Field label={s.sloganEn}>
        <Input value={v.sloganEn} onChange={set('sloganEn')} dir="ltr" />
      </Field>
      <Field label={s.website}>
        <Input value={v.websiteUrl} onChange={set('websiteUrl')} dir="ltr" placeholder="https://" />
      </Field>
      <Field label={s.phone}>
        <Input value={v.phone} onChange={set('phone')} dir="ltr" inputMode="tel" />
      </Field>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="press inline-flex h-11 items-center gap-2 rounded-xl bg-primary-container px-space-lg text-label-lg text-white disabled:opacity-60">
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {s.saveBrand}
        </button>
      </div>
    </form>
  );
}

export function ProductGrid({ products }: { products: ProductRow[] }) {
  const { locale } = useI18n();
  const s = adminStrings(locale).products;
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<(Omit<ProductRow, 'id' | 'imageUrl'> & { id?: string; imageUrl?: string | null }) | null>(null);
  const [image, setImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(p?: ProductRow) {
    setEditing(p ? { ...p } : { ...EMPTY, sortOrder: products.length });
    setImage(null);
    setPreview(p?.imageUrl ?? null);
  }

  return (
    <>
      <div className="mb-space-md flex justify-end">
        <button type="button" onClick={() => open()} className="press amber-gradient inline-flex h-11 items-center gap-2 rounded-xl px-space-md text-label-lg text-primary-container shadow-md">
          <Plus className="size-5" />
          {s.add}
        </button>
      </div>
      {products.length === 0 ? (
        <p className="rounded-2xl bg-surface-container-lowest p-space-lg text-center text-body-md text-on-surface-variant shadow-sm">{s.empty}</p>
      ) : (
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
          {products.map((p) => (
            <article key={p.id} className={`flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm ${p.isActive ? '' : 'opacity-60'}`}>
              <div className="relative aspect-square bg-surface-container-low">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center" style={{ background: p.swatch }}><PaintBucket className="size-10 text-primary-container/50" /></div>}
                <span className="absolute top-2 start-2 rounded-md bg-surface-container-lowest/90 px-2 py-0.5 text-label-sm text-primary">{s.categories[p.category]}</span>
                {p.isFeatured && <span className="absolute top-2 end-2 rounded-md bg-secondary-container px-2 py-0.5 text-label-sm text-on-secondary-fixed">★</span>}
              </div>
              <div className="flex flex-1 flex-col p-space-md">
                <h3 className="text-label-lg text-primary">{locale === 'ar' ? p.nameAr : p.nameEn}</h3>
                <p className="num mt-1 text-body-sm text-on-surface-variant">{p.sizes.join(' · ')}</p>
                <div className="mt-auto flex items-center justify-between gap-2 pt-space-sm">
                  <Switch
                    checked={p.isActive}
                    onChange={(on) =>
                      start(async () => {
                        const r = await toggleProductAction(p.id, on);
                        if (!r.ok) toast(r.error, 'error');
                        router.refresh();
                      })
                    }
                    label={<span className="text-label-sm">{p.isActive ? s.active : s.hidden}</span>}
                  />
                  <button type="button" onClick={() => open(p)} className="press inline-flex h-9 items-center gap-1 rounded-lg px-2 text-label-md text-primary-container hover:bg-surface-container-high">
                    <Pencil className="size-4" />
                    {s.edit}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onClose={() => (pending ? undefined : setEditing(null))} title={editing?.id ? s.edit : s.add}>
        {editing && (
          <form
            className="grid max-h-[70dvh] grid-cols-1 gap-space-sm overflow-y-auto sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                let imageUploadId: string | null = null;
                if (image) imageUploadId = await uploadFile('/admin/products/upload', image).catch(() => null);
                const { imageUrl: _ignored, ...rest } = editing;
                const r = await saveProductAction({ ...rest, descriptionAr: rest.descriptionAr || null, descriptionEn: rest.descriptionEn || null, finishAr: rest.finishAr || null, finishEn: rest.finishEn || null, imageUploadId });
                if (r.ok) {
                  toast(s.saved);
                  setEditing(null);
                  router.refresh();
                } else toast(r.error, 'error');
              });
            }}
          >
            <label className="sm:col-span-2 flex cursor-pointer items-center gap-space-md rounded-xl border border-dashed border-line-strong p-space-sm">
              {preview ? <img src={preview} alt="" className="size-20 rounded-lg object-cover" /> : <span className="grid size-20 place-items-center rounded-lg bg-surface-container"><ImagePlus className="size-7 text-muted" /></span>}
              <span className="text-label-md text-primary-container">{s.chooseImage}</span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const img = await processImage(f, 1600);
                  setImage(img.full);
                  setPreview(URL.createObjectURL(img.full));
                }}
              />
            </label>
            <Field label={s.nameAr}>
              <Input required value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
            </Field>
            <Field label={s.nameEn}>
              <Input required dir="ltr" value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
            </Field>
            <Field label={s.category}>
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as ProductRow['category'] })}>
                {Object.entries(s.categories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={s.coverage}>
              <Input inputMode="decimal" value={editing.coverageSqmPerLiter ?? ''} onChange={(e) => setEditing({ ...editing, coverageSqmPerLiter: e.target.value ? Number(e.target.value) : null })} className="num" />
            </Field>
            <Field label={s.descriptionAr} className="sm:col-span-2">
              <Textarea value={editing.descriptionAr ?? ''} onChange={(e) => setEditing({ ...editing, descriptionAr: e.target.value })} />
            </Field>
            <Field label={s.descriptionEn} className="sm:col-span-2">
              <Textarea dir="ltr" value={editing.descriptionEn ?? ''} onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })} />
            </Field>
            <Field label={s.finishAr}>
              <Input value={editing.finishAr ?? ''} onChange={(e) => setEditing({ ...editing, finishAr: e.target.value })} />
            </Field>
            <Field label={s.finishEn}>
              <Input dir="ltr" value={editing.finishEn ?? ''} onChange={(e) => setEditing({ ...editing, finishEn: e.target.value })} />
            </Field>
            <Field label={s.sizes}>
              <Input dir="ltr" value={editing.sizes.join(', ')} onChange={(e) => setEditing({ ...editing, sizes: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            </Field>
            <Field label={s.swatch}>
              <Input type="color" value={editing.swatch} onChange={(e) => setEditing({ ...editing, swatch: e.target.value.toUpperCase() })} className="h-12 p-1" />
            </Field>
            <Field label={s.sort}>
              <Input inputMode="numeric" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value.replace(/\D/g, '') || 0) })} className="num" />
            </Field>
            <div className="flex flex-col justify-end gap-space-xs">
              <Switch checked={editing.isFeatured} onChange={(v) => setEditing({ ...editing, isFeatured: v })} label={s.featured} />
              <Switch checked={editing.isActive} onChange={(v) => setEditing({ ...editing, isActive: v })} label={s.active} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-container text-label-lg text-white disabled:opacity-60">
                {pending && <LoaderCircle className="size-4 animate-spin" />}
                {s.save}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
