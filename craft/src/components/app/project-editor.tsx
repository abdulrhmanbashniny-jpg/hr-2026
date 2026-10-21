'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Switch } from '@/components/ui/controls';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError } from '@/lib/api-client';
import type { Catalogue } from '@/lib/catalogue';
import { useI18n } from '@/lib/i18n/client';
import { MediaManager, type MediaItem } from './media-manager';

export interface EditableProject {
  id: string;
  title: string;
  description: string | null;
  cityId: string | null;
  district: string | null;
  completedOn: string | null;
  areaSqm: number | null;
  brandId: string | null;
  colors: { name: string; code?: string; hex: string }[];
  warrantyMonths: number | null;
  isPublished: boolean;
  verification: 'self' | 'field_verified';
  media: MediaItem[];
}

export function ProjectEditor({ project, catalogue, defaultCityId }: { project?: EditableProject; catalogue: Pick<Catalogue, 'cities' | 'brands'>; defaultCityId: string }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState({
    title: project?.title ?? '',
    description: project?.description ?? '',
    cityId: project?.cityId ?? defaultCityId,
    district: project?.district ?? '',
    completedOn: project?.completedOn ?? '',
    areaSqm: project?.areaSqm ? String(project.areaSqm) : '',
    brandId: project?.brandId ?? '',
    warrantyMonths: project?.warrantyMonths ? String(project.warrantyMonths) : '12',
    isPublished: project?.isPublished ?? true,
  });
  const [colors, setColors] = useState(project?.colors ?? []);
  const [color, setColor] = useState({ name: '', code: '', hex: '#d8c9b0' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    const body = {
      title: form.title,
      description: form.description || null,
      cityId: form.cityId || null,
      district: form.district || null,
      completedOn: form.completedOn || null,
      areaSqm: form.areaSqm ? Number(form.areaSqm) : null,
      brandId: form.brandId || null,
      warrantyMonths: form.warrantyMonths ? Number(form.warrantyMonths) : null,
      isPublished: form.isPublished,
      colors,
    };
    try {
      if (project) {
        await api(`/portfolio/projects/${project.id}`, { method: 'PATCH', body });
        toast(t.common.saved);
        router.refresh();
      } else {
        const created = await api<{ id: string }>('/portfolio/projects', { body });
        router.replace(`/app/portfolio/${created.id}`);
      }
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!project || !confirm(t.portfolio.deleteConfirm)) return;
    await api(`/portfolio/projects/${project.id}`, { method: 'DELETE', body: {} });
    router.replace('/app/portfolio');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {project && (
        <Card>
          <CardHeader title={t.portfolio.media.title} subtitle={t.portfolio.media.hint} />
          <MediaManager projectId={project.id} initial={project.media} />
        </Card>
      )}
      <Card className="space-y-4">
        <Field label={t.portfolio.fields.title} htmlFor="title">
          <Input id="title" value={form.title} onChange={set('title')} placeholder={t.portfolio.fields.titlePlaceholder} maxLength={120} />
        </Field>
        <Field label={t.portfolio.fields.description} htmlFor="desc">
          <Textarea id="desc" value={form.description} onChange={set('description')} maxLength={1000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.portfolio.fields.city}>
            <Select value={form.cityId} onChange={set('cityId')}>
              {catalogue.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ar' ? c.nameAr : c.nameEn}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.portfolio.fields.district}>
            <Input value={form.district} onChange={set('district')} maxLength={60} />
          </Field>
          <Field label={t.portfolio.fields.completedOn}>
            <Input type="date" value={form.completedOn} onChange={set('completedOn')} className="num" />
          </Field>
          <Field label={t.portfolio.fields.area}>
            <Input inputMode="numeric" value={form.areaSqm} onChange={(e) => setForm((f) => ({ ...f, areaSqm: e.target.value.replace(/\D/g, '') }))} className="num" />
          </Field>
          <Field label={t.portfolio.fields.brand}>
            <Select value={form.brandId} onChange={set('brandId')}>
              <option value="">—</option>
              {catalogue.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === 'ar' ? b.nameAr : b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t.portfolio.fields.warranty}>
            <Input inputMode="numeric" value={form.warrantyMonths} onChange={(e) => setForm((f) => ({ ...f, warrantyMonths: e.target.value.replace(/\D/g, '') }))} className="num" />
          </Field>
        </div>
        <Field label={t.portfolio.fields.colors}>
          <div className="flex flex-wrap gap-2">
            {colors.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas py-1 ps-1 pe-2 text-xs">
                <span className="size-5 rounded-full border border-black/10" style={{ background: c.hex }} />
                {c.name}
                {c.code && <span className="num text-faint">{c.code}</span>}
                <button type="button" onClick={() => setColors((xs) => xs.filter((_, k) => k !== i))} className="text-faint hover:text-danger" aria-label={t.common.delete}>
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input type="color" value={color.hex} onChange={(e) => setColor((c) => ({ ...c, hex: e.target.value }))} className="h-11 w-12 cursor-pointer rounded-xl border border-line bg-surface p-1" aria-label="hex" />
            <Input value={color.name} onChange={(e) => setColor((c) => ({ ...c, name: e.target.value }))} placeholder={t.portfolio.fields.colorName} className="w-40 flex-1" />
            <Input value={color.code} onChange={(e) => setColor((c) => ({ ...c, code: e.target.value }))} placeholder={t.portfolio.fields.colorCode} className="num w-28" />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={t.common.add}
              disabled={!color.name.trim() || colors.length >= 12}
              onClick={() => {
                setColors((xs) => [...xs, { name: color.name.trim(), code: color.code.trim() || undefined, hex: color.hex }]);
                setColor((c) => ({ ...c, name: '', code: '' }));
              }}
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </Field>
        <Switch checked={form.isPublished} onChange={(v) => setForm((f) => ({ ...f, isPublished: v }))} label={t.portfolio.fields.published} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          {project ? (
            <Button variant="danger" onClick={destroy} icon={<Trash2 className="size-4" />}>
              {t.common.delete}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="accent" onClick={save} loading={saving} disabled={form.title.trim().length < 3}>
            {project ? t.common.save : t.common.continue}
          </Button>
        </div>
      </Card>
    </div>
  );
}
