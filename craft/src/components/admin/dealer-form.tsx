'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveDealerAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { isValidVatNumber } from '@/lib/ids';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

export function DealerForm({ brands, cities }: { brands: { id: string; name: string; nameAr: string }[]; cities: { id: string; nameAr: string; nameEn: string }[] }) {
  const { t, locale } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState({ name: '', vatNumber: '', brandId: '', cityId: 'riyadh' });
  const vatBad = d.vatNumber.length >= 15 && !isValidVatNumber(d.vatNumber);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.4fr_1fr_1fr_auto] lg:items-end">
      <Field label={c.dealers.name}>
        <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </Field>
      <Field label={c.dealers.vat} error={vatBad ? c.dealers.vatInvalid : undefined}>
        <Input inputMode="numeric" className="num" value={d.vatNumber} onChange={(e) => setD({ ...d, vatNumber: e.target.value.replace(/\D/g, '').slice(0, 15) })} aria-invalid={vatBad} />
      </Field>
      <Field label={c.dealers.brand}>
        <Select value={d.brandId} onChange={(e) => setD({ ...d, brandId: e.target.value })}>
          <option value="">{c.dealers.noBrand}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {locale === 'ar' ? b.nameAr : b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={c.dealers.city}>
        <Select value={d.cityId} onChange={(e) => setD({ ...d, cityId: e.target.value })}>
          {cities.map((x) => (
            <option key={x.id} value={x.id}>
              {locale === 'ar' ? x.nameAr : x.nameEn}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        variant="primary"
        loading={pending}
        disabled={d.name.trim().length < 3 || !isValidVatNumber(d.vatNumber)}
        onClick={() =>
          start(async () => {
            const r = await saveDealerAction({ name: d.name, vatNumber: d.vatNumber, brandId: d.brandId || null, cityId: d.cityId || null });
            toast(r.ok ? t.common.saved : r.error, r.ok ? 'success' : 'error');
            if (r.ok) {
              setD({ ...d, name: '', vatNumber: '' });
              router.refresh();
            }
          })
        }
      >
        {c.dealers.add}
      </Button>
    </div>
  );
}
