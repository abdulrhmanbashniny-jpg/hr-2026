import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('surface p-5 sm:p-6', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-primary-container">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-headline-sm text-primary-container">{title}</h3>
          {subtitle && <p className="mt-0.5 text-body-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface-container-lowest px-6 py-12 text-center">
      {icon && <div className="grid size-16 place-items-center rounded-2xl bg-secondary-fixed/50 text-secondary [&_svg]:size-8">{icon}</div>}
      <p className="text-headline-sm text-primary-container">{title}</p>
      {body && <p className="max-w-sm text-body-md text-muted">{body}</p>}
      {action}
    </div>
  );
}

/** DESIGN.md "Stats Cards": label and icon bucket, a large tabular figure, and a trend or status pill. */
export function Stat({ label, value, hint, icon, className, unit }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; className?: string; unit?: ReactNode }) {
  return (
    <div className={cn('flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-label-md text-muted">{label}</span>
        {icon && <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-primary-container [&_svg]:size-[22px]">{icon}</div>}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <span className="num text-headline-lg font-bold text-primary-container">{value}</span>
          {unit && <span className="text-label-sm text-muted">{unit}</span>}
        </span>
        {hint && <span className="text-label-sm text-muted">{hint}</span>}
      </div>
    </div>
  );
}

/** Page title block used at the top of every signed-in page. */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-space-lg flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-headline-lg-mobile text-primary-container sm:text-headline-lg">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-body-md text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-space-sm">{actions}</div>}
    </div>
  );
}
