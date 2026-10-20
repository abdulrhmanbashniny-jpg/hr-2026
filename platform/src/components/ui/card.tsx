import type { ReactNode } from 'react';

export function Card({ title, sub, action, children, flat, className = '' }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; flat?: boolean; className?: string }) {
  if (!title) return <div className={`ui-card ${flat ? 'ui-card--flat' : ''} ${className}`}>{children}</div>;
  return (
    <section className={`ui-card ui-card--flat ${className}`}>
      <div className="ui-card__head">
        <div className="min-w-0">
          <h2 className="ui-card__title">{title}</h2>
          {sub ? <p className="ui-card__sub">{sub}</p> : null}
        </div>
        {action}
      </div>
      {flat ? children : <div className="ui-card__body">{children}</div>}
    </section>
  );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-empty">
      {icon}
      <div>{children}</div>
    </div>
  );
}

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'dark';
export function Pill({ tone = 'gray', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`ui-pill ui-pill--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Notice({ tone, icon, children }: { tone: 'green' | 'amber' | 'red' | 'blue'; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`ui-notice ui-notice--${tone}`} role={tone === 'red' ? 'alert' : 'status'}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

/** A number in mono (kept LTR) followed by its unit in running text — safe inside Arabic sentences. */
export function Money({ value, unit, digits = 0 }: { value: number; unit: string; digits?: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="ui-num">{new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value)}</span> {unit}
    </span>
  );
}
