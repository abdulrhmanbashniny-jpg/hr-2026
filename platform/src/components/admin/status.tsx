import { Pill } from '@/components/ui/card';

export type SubStatusKey = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'none' | 'suspended';
export const STATUS_TONE: Record<SubStatusKey, 'green' | 'red' | 'amber' | 'blue' | 'gray'> = {
  active: 'green',
  trialing: 'blue',
  past_due: 'amber',
  canceled: 'gray',
  expired: 'red',
  none: 'gray',
  suspended: 'red',
};
/** Chart/meter colours per status: categorical slots for the neutral states, status colours only for good/bad. */
export const STATUS_FILL: Record<SubStatusKey, string> = {
  active: 'var(--exp-valid)',
  trialing: 'var(--chart-1)',
  past_due: 'var(--exp-d30)',
  canceled: 'var(--chart-7)',
  expired: 'var(--exp-expired)',
  none: 'var(--muted)',
  suspended: 'var(--exp-expired)',
};

export function StatusPill({ status, label }: { status: SubStatusKey; label: string }) {
  return (
    <span className={`ui-pill ui-pill--${STATUS_TONE[status]} ui-pill--dot`}>{label}</span>
  );
}
