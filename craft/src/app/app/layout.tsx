import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NotificationBell } from '@/components/app/notification-bell';
import { PortalShell, type ShellItem } from '@/components/shell/portal-shell';
import { requirePortalPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { mediaUrl } from '@/lib/storage';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.dashboard, robots: { index: false } };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await requirePortalPage('/app');
  if (!s.craftsman) return <div className="min-h-dvh bg-surface">{children}</div>;
  const { t } = await getI18n();
  const c = s.craftsman;
  const items: ShellItem[] = [
    { href: '/app', label: t.nav.dashboard, icon: 'card' },
    { href: '/app/portfolio', label: t.nav.portfolio, icon: 'portfolio' },
    { href: '/app/invoices', label: t.nav.invoices, icon: 'invoices' },
    { href: '/app/rewards', label: t.nav.rewards, icon: 'rewards' },
    { href: '/app/referrals', label: t.nav.referrals, icon: 'referrals' },
    { href: '/app/profile', label: t.nav.profile, icon: 'profile' },
    { href: '/app/notifications', label: t.nav.notifications, icon: 'notifications' },
    { href: '/', label: t.nav.site, icon: 'site' },
  ];
  return (
    <PortalShell
      items={items}
      portalName={t.nav.portal}
      user={{ name: c.displayName, avatarUrl: mediaUrl(c.avatarKey), subtitle: t.tiers.letter[c.tier], href: '/app/profile' }}
      status={{ label: t.nav.status, value: t.tiers.badge[c.tier] }}
      cta={{ href: '/app/invoices/scan', label: t.nav.scan }}
      search={{ placeholder: t.nav.searchMember, scope: 'member' }}
      bell={<NotificationBell />}
      tabs={[items[0], items[1], items[3], items[5]]}
    >
      {children}
    </PortalShell>
  );
}
