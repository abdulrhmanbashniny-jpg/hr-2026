'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { adjustPointsAction, setTierAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

export function TierForm({ craftsmanId, tier }: { craftsmanId: string; tier: 'A' | 'B' | 'C' }) {
  const { t } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [value, setValue] = useState(tier);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(['A', 'B', 'C'] as const).map((x) => (
          <button key={x} type="button" onClick={() => setValue(x)} className={cn('press rounded-xl border px-2 py-2.5 text-xs font-medium', value === x ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line text-ink-2')}>
            {t.tiers.short[x]}
          </button>
        ))}
      </div>
      <Field label={c.craftsmen.tierReason}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Field>
      <Button
        variant="primary"
        className="w-full"
        loading={pending}
        disabled={value === tier || reason.trim().length < 3}
        onClick={() =>
          start(async () => {
            const r = await setTierAction(craftsmanId, value, reason);
            toast(r.ok ? t.common.saved : r.error, r.ok ? 'success' : 'error');
            if (r.ok) router.refresh();
          })
        }
      >
        {c.craftsmen.saveTier}
      </Button>
    </div>
  );
}

export function AdjustForm({ craftsmanId }: { craftsmanId: string }) {
  const { t } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();
  const n = Number(points.replace(/[^\d-]/g, ''));
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{c.craftsmen.adjustHint}</p>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <Field label={c.craftsmen.adjustPoints}>
          <Input inputMode="numeric" dir="ltr" className="num" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="+500" />
        </Field>
        <Field label={c.craftsmen.adjustNote}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
      </div>
      <Button
        variant="secondary"
        className="w-full"
        loading={pending}
        disabled={!Number.isInteger(n) || n === 0 || note.trim().length < 3}
        onClick={() =>
          start(async () => {
            const r = await adjustPointsAction(craftsmanId, n, note);
            toast(r.ok ? t.common.saved : r.error, r.ok ? 'success' : 'error');
            if (r.ok) {
              setPoints('');
              setNote('');
              router.refresh();
            }
          })
        }
      >
        {c.craftsmen.adjustSave}
      </Button>
    </div>
  );
}
