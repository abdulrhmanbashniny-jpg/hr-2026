'use client';

import { useState } from 'react';
import { Segmented } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n/client';

type Availability = 'available' | 'busy' | 'away';

export function AvailabilityToggle({ initial }: { initial: Availability }) {
  const { t } = useI18n();
  const toast = useToast();
  const [value, setValue] = useState<Availability>(initial);
  async function change(v: Availability) {
    const prev = value;
    setValue(v);
    try {
      await api('/me/availability', { method: 'PATCH', body: { availability: v } });
      toast(t.availability[v]);
    } catch {
      setValue(prev);
      toast(t.errors.generic, 'error');
    }
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2.5 rounded-full ${value === 'available' ? 'bg-success' : value === 'busy' ? 'bg-accent' : 'bg-faint'}`} style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
      <Segmented
        size="sm"
        value={value}
        onChange={change}
        options={(['available', 'busy', 'away'] as const).map((v) => ({ value: v, label: t.availability[v] }))}
      />
    </div>
  );
}
