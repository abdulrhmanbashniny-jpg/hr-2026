import type { ReactNode } from 'react';

export function Kpi({ label, value, foot, icon, tone }: { label: string; value: ReactNode; foot?: ReactNode; icon?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="ui-kpi">
      <span className="ui-kpi__label">
        {icon}
        {label}
      </span>
      <span className="ui-kpi__value">{value}</span>
      {foot ? <span className={`ui-kpi__foot ${tone === 'up' ? 'ui-kpi__delta--up' : tone === 'down' ? 'ui-kpi__delta--down' : ''}`}>{foot}</span> : null}
    </div>
  );
}
