import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export type TileColor = 'blue' | 'indigo' | 'teal' | 'green' | 'orange' | 'pink' | 'purple' | 'red';
const TILE: Record<TileColor, string> = {
  blue: 'var(--accent)',
  indigo: 'var(--accent-2)',
  teal: 'var(--teal)',
  green: 'var(--green)',
  orange: 'var(--saffron)',
  pink: 'var(--pink)',
  purple: 'var(--purple)',
  red: 'var(--exp-expired)',
};
const ROTATION: TileColor[] = ['blue', 'indigo', 'teal', 'green', 'orange', 'purple', 'pink'];

/** Stable colour per label, so a tile keeps its colour across visits without every call site choosing one. */
function tileFor(label: string): TileColor {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROTATION[h % ROTATION.length];
}

export function Kpi({ label, value, foot, icon, tone, color, href }: { label: string; value: ReactNode; foot?: ReactNode; icon?: ReactNode; tone?: 'up' | 'down'; color?: TileColor; href?: string }) {
  const style = { '--tile': TILE[color ?? (tone === 'down' ? 'orange' : tileFor(label))] } as CSSProperties;
  const body = (
    <>
      <span className="ui-kpi__label">
        {icon ? <span className="ui-kpi__icon">{icon}</span> : null}
        {label}
      </span>
      <span className="ui-kpi__value">{value}</span>
      {foot ? <span className={`ui-kpi__foot ${tone === 'up' ? 'ui-kpi__delta--up' : tone === 'down' ? 'ui-kpi__delta--down' : ''}`}>{foot}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="ui-kpi" style={style}>
      {body}
    </Link>
  ) : (
    <div className="ui-kpi" style={style}>
      {body}
    </div>
  );
}
