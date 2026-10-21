'use client';

import { useRef } from 'react';
import { cn } from '@/lib/cn';
import { digitsOnly } from '@/lib/digits';

/** One real input (so SMS autofill and paste work) drawn as six boxes. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" dir="ltr" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        disabled={disabled}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="OTP"
        aria-invalid={invalid}
        maxLength={6}
        onChange={(e) => {
          const v = digitsOnly(e.target.value).slice(0, 6);
          onChange(v);
          if (v.length === 6) onComplete?.(v);
        }}
        className="absolute inset-0 z-10 size-full cursor-text opacity-0"
      />
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }, (_, i) => {
          const active = i === Math.min(value.length, 5);
          return (
            <div
              key={i}
              className={cn(
                'num grid aspect-[4/5] place-items-center rounded-xl border bg-surface text-2xl font-semibold text-ink shadow-sm transition',
                invalid ? 'border-danger' : active ? 'border-accent ring-4 ring-[var(--ring)]' : 'border-line',
              )}
            >
              {value[i] ?? ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
