'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { fulfillRedemptionAction, rejectRedemptionAction, saveRewardAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

function useRun() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
      start(async () => {
        const r = await fn();
        toast(r.ok ? t.common.saved : (r.error ?? t.errors.generic), r.ok ? 'success' : 'error');
        if (r.ok) {
          after?.();
          router.refresh();
        }
      }),
  };
}

export function FulfillRow({ id, needsCode }: { id: string; needsCode: boolean }) {
  const c = useConsole();
  const [code, setCode] = useState('');
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {needsCode && <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={c.rewards.voucher} className="num h-9 w-48" />}
      <Button size="sm" variant="accent" loading={pending} disabled={needsCode && code.trim().length < 4} onClick={() => run(() => fulfillRedemptionAction(id, code))}>
        {c.rewards.fulfill}
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => rejectRedemptionAction(id))}>
        {c.rewards.reject}
      </Button>
    </div>
  );
}

export interface AdminReward {
  id?: string;
  kind: 'fuel_voucher' | 'supplier_discount' | 'tool' | 'cash_out' | 'other';
  titleAr: string;
  titleEn: string;
  partnerName: string | null;
  pointsCost: number;
  valueSar: number | null;
  stock: number | null;
  minTier: 'A' | 'B' | 'C' | null;
  isActive: boolean;
}

export function RewardEditor({ reward, onDone }: { reward?: AdminReward; onDone?: () => void }) {
  const { t } = useI18n();
  const c = useConsole();
  const { pending, run } = useRun();
  const [r, setR] = useState<AdminReward>(reward ?? { kind: 'tool', titleAr: '', titleEn: '', partnerName: null, pointsCost: 1000, valueSar: null, stock: null, minTier: null, isActive: true });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label={c.rewards.titleAr}>
        <Input value={r.titleAr} onChange={(e) => setR({ ...r, titleAr: e.target.value })} />
      </Field>
      <Field label={c.rewards.titleEn}>
        <Input value={r.titleEn} onChange={(e) => setR({ ...r, titleEn: e.target.value })} dir="ltr" />
      </Field>
      <Field label={c.rewards.kind}>
        <Select value={r.kind} onChange={(e) => setR({ ...r, kind: e.target.value as AdminReward['kind'] })}>
          {(['fuel_voucher', 'supplier_discount', 'tool', 'cash_out', 'other'] as const).map((k) => (
            <option key={k} value={k}>
              {t.rewards.kinds[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={c.rewards.partner}>
        <Input value={r.partnerName ?? ''} onChange={(e) => setR({ ...r, partnerName: e.target.value || null })} />
      </Field>
      <Field label={c.rewards.cost}>
        <Input inputMode="numeric" className="num" value={r.pointsCost} onChange={(e) => setR({ ...r, pointsCost: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
      </Field>
      <Field label={c.rewards.value}>
        <Input inputMode="decimal" className="num" value={r.valueSar ?? ''} onChange={(e) => setR({ ...r, valueSar: e.target.value ? Number(e.target.value) : null })} />
      </Field>
      <Field label={c.rewards.stock}>
        <Input inputMode="numeric" className="num" value={r.stock ?? ''} placeholder={c.rewards.unlimited} onChange={(e) => setR({ ...r, stock: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} />
      </Field>
      <Field label={c.rewards.minTier}>
        <Select value={r.minTier ?? ''} onChange={(e) => setR({ ...r, minTier: (e.target.value || null) as AdminReward['minTier'] })}>
          <option value="">{c.rewards.anyTier}</option>
          {(['A', 'B', 'C'] as const).map((x) => (
            <option key={x} value={x}>
              {t.tiers.short[x]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center justify-between gap-4 sm:col-span-2 lg:col-span-4">
        <Switch checked={r.isActive} onChange={(v) => setR({ ...r, isActive: v })} label={c.rewards.active} />
        <Button variant="primary" loading={pending} disabled={r.titleAr.trim().length < 3 || r.titleEn.trim().length < 3 || r.pointsCost < 1} onClick={() => run(() => saveRewardAction(r), onDone)}>
          {c.rewards.save}
        </Button>
      </div>
    </div>
  );
}

export function NewReward() {
  const c = useConsole();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return open ? (
    <RewardEditor
      key={key}
      onDone={() => {
        setOpen(false);
        setKey((k) => k + 1);
      }}
    />
  ) : (
    <Button variant="secondary" onClick={() => setOpen(true)}>
      {c.rewards.newReward}
    </Button>
  );
}
