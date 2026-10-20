'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="ui-tabs" aria-label="admin">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="ui-tab" aria-selected={pathname === i.href}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
