'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function Sidebar({ product, tenantName, groups, footer }: { product: string; tenantName: string; groups: NavGroup[]; footer?: ReactNode }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  return (
    <aside className="ui-side" aria-label={product}>
      <Link href="/app" className="ui-side__brand" style={{ textDecoration: 'none', color: 'inherit' }}>
        <span className="ui-side__name">{product}</span>
        <span className="ui-side__tenant">{tenantName}</span>
      </Link>
      {groups.map((g, i) => (
        <nav key={i} aria-label={g.label}>
          {g.label ? <span className="ui-side__group">{g.label}</span> : null}
          {g.items.map((item) => (
            <Link key={item.href} href={item.href} className="ui-side__item" aria-current={isActive(item) ? 'page' : undefined}>
              {item.icon}
              <span className="truncate">{item.label}</span>
              {item.count ? <span className="ui-side__count">{item.count}</span> : null}
            </Link>
          ))}
        </nav>
      ))}
      {footer ? <div style={{ marginTop: 'auto' }}>{footer}</div> : null}
    </aside>
  );
}
