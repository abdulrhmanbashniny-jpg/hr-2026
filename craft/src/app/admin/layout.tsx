import { and, count, eq, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { db } from '@/db';
import { fraudFlags, invoices, redemptions, verificationDocuments } from '@/db/schema';
import { ConsoleI18nProvider } from '@/components/admin/console-i18n';
import { ConsoleMobileBar, ConsoleSidebar, type ConsoleNavItem } from '@/components/admin/console-nav';
import { requireStaffPage } from '@/lib/auth/guards';
import { staffCan, type StaffPermission } from '@/lib/auth/roles';
import { getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: consoleDictionary(locale).title, robots: { index: false } };
}

const ALL: (ConsoleNavItem & { permission: StaffPermission })[] = [
  { href: '/admin', key: 'overview', permission: 'console:view' },
  { href: '/admin/invoices', key: 'invoices', permission: 'invoices:review' },
  { href: '/admin/craftsmen', key: 'craftsmen', permission: 'craftsmen:view' },
  { href: '/admin/verification', key: 'verification', permission: 'craftsmen:manage' },
  { href: '/admin/fraud', key: 'fraud', permission: 'fraud:view' },
  { href: '/admin/incentives', key: 'incentives', permission: 'incentives:manage' },
  { href: '/admin/rewards', key: 'rewards', permission: 'redemptions:fulfill' },
  { href: '/admin/dealers', key: 'dealers', permission: 'dealers:manage' },
  { href: '/admin/map', key: 'map', permission: 'console:view' },
  { href: '/admin/reports', key: 'reports', permission: 'reports:export' },
  { href: '/admin/settings', key: 'settings', permission: 'settings:manage' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireStaffPage();
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const [[q], [f], [r], [d]] = await Promise.all([
    db.select({ n: count() }).from(invoices).where(inArray(invoices.status, ['pending', 'flagged'])),
    db.select({ n: count() }).from(fraudFlags).where(eq(fraudFlags.status, 'open')),
    db.select({ n: count() }).from(redemptions).where(eq(redemptions.status, 'requested')),
    db.select({ n: count() }).from(verificationDocuments).where(and(eq(verificationDocuments.status, 'pending'))),
  ]);
  const badges: Partial<Record<ConsoleNavItem['key'], number>> = { invoices: q.n, fraud: f.n, rewards: r.n, verification: d.n };
  const items = ALL.filter((i) => staffCan(s.user.role, i.permission)).map(({ permission: _p, ...i }) => ({ ...i, badge: badges[i.key] }));
  return (
    <ConsoleI18nProvider c={c}>
      <div className="flex min-h-dvh">
        <ConsoleSidebar items={items} user={{ name: s.user.name ?? s.user.phone, role: c.roles[s.user.role] }} />
        <div className="min-w-0 flex-1">
          <ConsoleMobileBar items={items} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </ConsoleI18nProvider>
  );
}
