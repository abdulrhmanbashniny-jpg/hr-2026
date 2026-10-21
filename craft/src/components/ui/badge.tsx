import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'navy';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
  accent: 'bg-accent-soft text-[#9a5b00] dark:text-accent-2 border-[#fde3b0] dark:border-transparent',
  navy: 'bg-navy-900 text-white border-transparent',
};

export function Badge({ tone = 'neutral', icon, children, className, dot }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />}
      {icon}
      {children}
    </span>
  );
}
