'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { saveRuleAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { invoicePoints, resolveIncentive, type IncentiveRuleLike, type Tier } from '@/lib/incentives/engine';
import type { Economics } from '@/lib/settings/economics';
import { f, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

type Scope = 'national' | 'region' | 'city';
type Target = 'invoice' | 'referral_bonus' | 'commission';

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function IncentiveEditor({ regions, cities, rules, eco }: { regions: { code: string; nameAr: string; nameEn: string }[]; cities: { id: string; regionCode: string; nameAr: string; nameEn: string }[]; rules: IncentiveRuleLike[]; eco: Economics }) {
  const { t, locale } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    name: '',
    target: 'invoice' as Target,
    scope: 'city' as Scope,
    regionCode: regions[0]?.code ?? '',
    cityId: 'riyadh',
    multiplier: '2',
    flatBonus: '0',
    startsAt: toLocalInput(new Date()),
    endsAt: toLocalInput(new Date(Date.now() + 14 * 86_400_000)),
  });
  const [preview, setPreview] = useState({ cityId: 'riyadh', amount: '1150', tier: 'B' as Tier });
  const label = (x: { nameAr: string; nameEn: string }) => (locale === 'ar' ? x.nameAr : x.nameEn);

  const draft: IncentiveRuleLike | null = form.name.trim()
    ? {
        id: 'draft',
        name: form.name,
        target: form.target,
        scope: form.scope,
        regionCode: form.scope === 'region' ? form.regionCode : null,
        cityId: form.scope === 'city' ? form.cityId : null,
        multiplier: Number(form.multiplier) || 1,
        flatBonus: Number(form.flatBonus) || 0,
        startsAt: new Date(form.startsAt),
        endsAt: new Date(form.endsAt),
        isActive: true,
      }
    : null;

  const result = useMemo(() => {
    const city = cities.find((x) => x.id === preview.cityId);
    const all = draft ? [...rules, draft] : rules;
    const inc = resolveIncentive(all, { target: 'invoice', cityId: preview.cityId, regionCode: city?.regionCode ?? null, at: new Date() }, eco.maxMultiplier);
    const total = Number(preview.amount) || 0;
    return { pts: invoicePoints({ total, vat: null, tier: preview.tier, incentive: inc }, eco), city };
  }, [rules, draft, preview, cities, eco]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="surface space-y-4 p-5">
        <h2 className="font-semibold">{c.incentives.new}</h2>
        <Field label={c.incentives.name}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
        </Field>
        <Field label={c.incentives.target}>
          <Segmented size="sm" value={form.target} onChange={(v) => setForm({ ...form, target: v })} options={(['invoice', 'referral_bonus', 'commission'] as const).map((v) => ({ value: v, label: c.incentives.targets[v] }))} />
        </Field>
        <Field label={c.incentives.scope}>
          <Segmented size="sm" value={form.scope} onChange={(v) => setForm({ ...form, scope: v })} options={(['national', 'region', 'city'] as const).map((v) => ({ value: v, label: c.incentives.scopes[v] }))} />
        </Field>
        {form.scope === 'region' && (
          <Field label={c.incentives.region}>
            <Select value={form.regionCode} onChange={(e) => setForm({ ...form, regionCode: e.target.value })}>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {label(r)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {form.scope === 'city' && (
          <Field label={c.incentives.city}>
            <Select value={form.cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
              {cities.map((x) => (
                <option key={x.id} value={x.id}>
                  {label(x)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={c.incentives.multiplier}>
            <Input inputMode="decimal" className="num" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: e.target.value })} />
          </Field>
          <Field label={c.incentives.flatBonus}>
            <Input inputMode="numeric" className="num" value={form.flatBonus} onChange={(e) => setForm({ ...form, flatBonus: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label={c.incentives.startsAt}>
            <Input type="datetime-local" className="num" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </Field>
          <Field label={c.incentives.endsAt}>
            <Input type="datetime-local" className="num" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="accent"
            loading={pending}
            disabled={!draft || Number(form.multiplier) < 1}
            onClick={() =>
              start(async () => {
                const r = await saveRuleAction({
                  name: form.name,
                  target: form.target,
                  scope: form.scope,
                  regionCode: form.scope === 'region' ? form.regionCode : null,
                  cityId: form.scope === 'city' ? form.cityId : null,
                  multiplier: Number(form.multiplier),
                  flatBonus: Number(form.flatBonus) || 0,
                  startsAt: new Date(form.startsAt).toISOString(),
                  endsAt: new Date(form.endsAt).toISOString(),
                });
                toast(r.ok ? t.common.saved : r.error, r.ok ? 'success' : 'error');
                if (r.ok) {
                  setForm({ ...form, name: '' });
                  router.refresh();
                }
              })
            }
          >
            {c.incentives.save}
          </Button>
        </div>
      </div>
      <div className="navy-gradient grain relative overflow-hidden rounded-3xl p-5 text-white">
        <div className="relative space-y-4">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Sparkles className="size-4 text-accent-2" />
            {c.incentives.preview}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <select value={preview.cityId} onChange={(e) => setPreview({ ...preview, cityId: e.target.value })} className="h-10 rounded-xl border border-white/15 bg-white/10 px-2 text-sm text-white">
              {cities.map((x) => (
                <option key={x.id} value={x.id} className="text-ink">
                  {label(x)}
                </option>
              ))}
            </select>
            <select value={preview.tier} onChange={(e) => setPreview({ ...preview, tier: e.target.value as Tier })} className="h-10 rounded-xl border border-white/15 bg-white/10 px-2 text-sm text-white">
              {(['A', 'B', 'C'] as const).map((x) => (
                <option key={x} value={x} className="text-ink">
                  {t.tiers.short[x]}
                </option>
              ))}
            </select>
            <input value={preview.amount} onChange={(e) => setPreview({ ...preview, amount: e.target.value.replace(/[^\d.]/g, '') })} inputMode="decimal" className="num col-span-2 h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-white" />
          </div>
          <p className="text-sm text-white/75">{f(c.incentives.previewBody, { amount: fmtNumber(Number(preview.amount) || 0), city: result.city ? label(result.city) : '', tier: t.tiers.short[preview.tier] })}</p>
          <div className="num text-5xl font-semibold text-accent-2">{fmtNumber(result.pts.points)}</div>
          <div className="space-y-1 text-xs text-white/65">
            <div>
              base <span className="num">{fmtNumber(result.pts.basePoints)}</span> × tier <span className="num">{result.pts.tierMultiplier}</span> × campaign <span className="num">{result.pts.incentive.multiplier}</span> + <span className="num">{result.pts.incentive.flatBonus}</span>
            </div>
            {result.pts.incentive.appliedRuleNames.length > 0 && <div>{result.pts.incentive.appliedRuleNames.join(' · ')}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
