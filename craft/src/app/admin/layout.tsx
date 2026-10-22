import { and, count, eq, inArray } from 'drizzle-orm';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { db } from '@/db';
import { fraudFlags, invoices, redemptions, reviews, verificationDocuments } from '@/db/schema';
import { ConsoleI18nProvider } from '@/components/admin/console-i18n';
import { PortalShell, type ShellIcon, type ShellItem } from '@/components/shell/portal-shell';
import { requireStaffPage } from '@/lib/auth/guards';
import { staffCan, type StaffPermission } from '@/lib/auth/roles';
import { getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: consoleDictionary(locale).title, robots: { index: false } };
}

type NavKey = 'overview' | 'invoices' | 'craftsmen' | 'verification' | 'reviews' | 'fraud' | 'incentives' | 'rewards' | 'products' | 'dealers' | 'map' | 'reports' | 'settings';

const ALL: { href: string; key: NavKey; icon: ShellIcon; permission: StaffPermission }[] = [
  { href: '/admin', key: 'overview', icon: 'dashboard', permission: 'console:view' },
  { href: '/admin/invoices', key: 'invoices', icon: 'invoices', permission: 'invoices:review' },
  { href: '/admin/craftsmen', key: 'craftsmen', icon: 'referrals', permission: 'craftsmen:view' },
  { href: '/admin/verification', key: 'verification', icon: 'verification', permission: 'craftsmen:manage' },
  { href: '/admin/reviews', key: 'reviews', icon: 'reviews', permission: 'reviews:moderate' },
  { href: '/admin/fraud', key: 'fraud', icon: 'fraud', permission: 'fraud:view' },
  { href: '/admin/incentives', key: 'incentives', icon: 'incentives', permission: 'incentives:manage' },
  { href: '/admin/rewards', key: 'rewards', icon: 'gift', permission: 'redemptions:fulfill' },
  { href: '/admin/products', key: 'products', icon: 'products', permission: 'products:manage' },
  { href: '/admin/dealers', key: 'dealers', icon: 'dealers', permission: 'dealers:manage' },
  { href: '/admin/map', key: 'map', icon: 'map', permission: 'console:view' },
  { href: '/admin/reports', key: 'reports', icon: 'reports', permission: 'reports:export' },
  { href: '/admin/settings', key: 'settings', icon: 'settings', permission: 'settings:manage' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireStaffPage();
  const { locale, t } = await getI18n();
  const c = consoleDictionary(locale);
  const [[q], [f], [r], [d], [v]] = await Promise.all([
    db.select({ n: count() }).from(invoices).where(inArray(invoices.status, ['pending', 'flagged'])),
    db.select({ n: count() }).from(fraudFlags).where(eq(fraudFlags.status, 'open')),
    db.select({ n: count() }).from(redemptions).where(eq(redemptions.status, 'requested')),
    db.select({ n: count() }).from(verificationDocuments).where(and(eq(verificationDocuments.status, 'pending'))),
    db.select({ n: count() }).from(reviews).where(eq(reviews.status, 'pending')),
  ]);
  const badges: Partial<Record<NavKey, number>> = { invoices: q.n, fraud: f.n, rewards: r.n, verification: d.n, reviews: v.n };
  const items: ShellItem[] = ALL.filter((i) => staffCan(s.user.role, i.permission)).map((i) => ({ href: i.href, label: c.nav[i.key], icon: i.icon, badge: badges[i.key] }));
  items.push({ href: '/', label: c.nav.backToSite, icon: 'site' });
  const name = s.user.name ?? s.user.phone;
  return (
    <ConsoleI18nProvider c={c}>
      <PortalShell
        items={items}
        portalName={c.nav.portal}
        user={{ name, subtitle: c.roles[s.user.role] }}
        status={{ label: c.nav.signedInAs, value: c.roles[s.user.role] }}
        search={{ placeholder: c.nav.search, scope: 'console' }}
      >
        <div className="sr-only">{t.meta.product}</div>
        {children}
      </PortalShell>
    </ConsoleI18nProvider>
  );
}
