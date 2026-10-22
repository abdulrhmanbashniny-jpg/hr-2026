import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'navy';

/** DESIGN.md "Arabic Badges": 26 px, rounded-md, tinted backgrounds. */
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-container text-on-surface-variant',
  success: 'bg-[rgb(16_185_129/0.1)] text-[#047857]',
  warning: 'bg-[rgb(245_158_11/0.1)] text-[#B45309]',
  danger: 'bg-[rgb(239_68_68/0.1)] text-[#B91C1C]',
  info: 'bg-info-soft text-info',
  accent: 'bg-secondary/15 text-on-secondary-container',
  navy: 'bg-primary-container text-white',
};

export function Badge({ tone = 'neutral', icon, children, className, dot }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-label-sm whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />}
      {icon}
      {children}
    </span>
  );
}
