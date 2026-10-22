import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-xl border border-line bg-surface-container-lowest px-4 text-body-md text-[#0F172A] placeholder:text-muted transition outline-none focus:border-accent-2 focus:ring-[3px] focus:ring-[var(--ring)] disabled:opacity-60 aria-[invalid=true]:border-[#EF4444] aria-[invalid=true]:ring-[3px] aria-[invalid=true]:ring-[rgb(239_68_68/0.2)]';

export function Field({ label, hint, error, children, className, htmlFor }: { label?: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-label-md font-semibold text-primary-container">
          {label}
        </label>
      )}
      {children}
      {error ? <p className="text-[13px] text-danger">{error}</p> : hint ? <p className="text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, 'h-12', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(control, 'h-12 appearance-none bg-[length:16px] bg-no-repeat pe-9 [background-position:left_12px_center] rtl:[background-position:left_12px_center] ltr:[background-position:right_12px_center]', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23627d98' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-2', className)}>
      <input type="checkbox" {...props} className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border-line accent-[#102a43]" />
      <span>{label}</span>
    </label>
  );
}
