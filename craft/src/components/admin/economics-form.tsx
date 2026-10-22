'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveEconomicsAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import type { Economics } from '@/lib/settings/economics';
import { useConsole } from './console-i18n';

type FlatKey = Exclude<keyof Economics, 'tierMultipliers'> | 'tierA' | 'tierB' | 'tierC';
const GROUPS: FlatKey[][] = [
  ['pointsPerSar', 'pointValueSar', 'tierA', 'tierB', 'tierC'],
  ['welcomeBonus', 'referralBonus', 'commissionL1Pct', 'commissionL2Pct', 'maxMultiplier'],
  ['invoiceMaxAgeDays', 'invoiceMaxAmountSar', 'dailyInvoiceCap', 'autoApproveMaxRisk', 'flagMinRisk'],
];

export function EconomicsForm({ value }: { value: Economics }) {
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState<Record<FlatKey, string>>(() => {
    const { tierMultipliers, ...rest } = value;
    return { ...Object.fromEntries(Object.entries(rest).map(([k, x]) => [k, String(x)])), tierA: String(tierMultipliers.A), tierB: String(tierMultipliers.B), tierC: String(tierMultipliers.C) } as Record<FlatKey, string>;
  });
  function save() {
    const n = (k: FlatKey) => Number(v[k]);
    const payload = {
      pointsPerSar: n('pointsPerSar'),
      pointValueSar: n('pointValueSar'),
      tierMultipliers: { A: n('tierA'), B: n('tierB'), C: n('tierC') },
      welcomeBonus: n('welcomeBonus'),
      referralBonus: n('referralBonus'),
      commissionL1Pct: n('commissionL1Pct'),
      commissionL2Pct: n('commissionL2Pct'),
      maxMultiplier: n('maxMultiplier'),
      invoiceMaxAgeDays: n('invoiceMaxAgeDays'),
      invoiceMaxAmountSar: n('invoiceMaxAmountSar'),
      dailyInvoiceCap: n('dailyInvoiceCap'),
      autoApproveMaxRisk: n('autoApproveMaxRisk'),
      flagMinRisk: n('flagMinRisk'),
    };
    start(async () => {
      const r = await saveEconomicsAction(payload);
      toast(r.ok ? c.settings.saved : r.error, r.ok ? 'success' : 'error');
      if (r.ok) router.refresh();
    });
  }
  return (
    <div className="space-y-6">
      {GROUPS.map((g, i) => (
        <div key={i} className="surface grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {g.map((k) => (
            <Field key={k} label={c.settings.fields[k]}>
              <Input inputMode="decimal" className="num" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.]/g, '') })} />
            </Field>
          ))}
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="accent" loading={pending} onClick={save}>
          {c.rewards.save}
        </Button>
      </div>
    </div>
  );
}
