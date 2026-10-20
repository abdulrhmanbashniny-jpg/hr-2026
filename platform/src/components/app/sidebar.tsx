'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BrandGlyph } from '@/components/ui/brand';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
  /** "alert" paints the count red (open compliance alerts, pending approvals). */
  countTone?: 'alert';
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function Sidebar({ product, tenantName, groups, footer, home = '/app' }: { product: string; tenantName: string; groups: NavGroup[]; footer?: ReactNode; home?: string }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));
  return (
    <aside className="ui-side" aria-label={product}>
      <Link href={home} className="ui-side__brand">
        <span className="ui-side__logo">
          <BrandGlyph />
        </span>
        <span className="ui-side__titles">
          <span className="ui-side__name">{product}</span>
          <span className="ui-side__tenant">{tenantName}</span>
        </span>
      </Link>
      {groups.map((g, i) => (
        <nav key={i} aria-label={g.label}>
          {g.label ? <span className="ui-side__group">{g.label}</span> : null}
          {g.items.map((item) => (
            <Link key={item.href} href={item.href} className="ui-side__item" aria-current={isActive(item) ? 'page' : undefined}>
              {item.icon}
              <span className="truncate">{item.label}</span>
              {item.count ? (
                <span className="ui-side__count" data-tone={item.countTone}>
                  {item.count > 999 ? '999+' : item.count}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      ))}
      {footer ? <div className="ui-side__foot">{footer}</div> : null}
    </aside>
  );
}
