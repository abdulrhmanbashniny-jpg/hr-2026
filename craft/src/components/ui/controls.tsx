'use client';

import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4 text-sm text-ink', disabled && 'opacity-60')}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
      >
        <motion.span layout className={cn('absolute top-1 size-5 rounded-full bg-white shadow-sm', checked ? 'start-6' : 'start-1')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md' }) {
  const id = useId();
  return (
    <div role="tablist" className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn('relative rounded-lg font-medium transition-colors', size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm', active ? 'text-ink' : 'text-muted hover:text-ink')}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-surface-container-lowest shadow-sm" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Progress({ value, className, tone = 'accent' }: { value: number; className?: string; tone?: 'accent' | 'navy' | 'success' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className={cn('h-full rounded-full', tone === 'accent' ? 'amber-gradient' : tone === 'success' ? 'bg-success' : 'bg-navy-900 dark:bg-navy-200')}
      />
    </div>
  );
}
