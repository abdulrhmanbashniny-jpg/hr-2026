import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { MobileTopBar, Sidebar, TabBar } from '@/components/app/nav';
import { NotificationBell } from '@/components/app/notification-bell';
import { requireUserPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.nav.home, robots: { index: false } };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await requireUserPage('/app');
  if (!s.craftsman) return <div className="min-h-dvh">{children}</div>;
  const user = { name: s.craftsman.displayName, code: s.craftsman.referralCode, tier: s.craftsman.tier };
  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1">
        <MobileTopBar user={user} />
        <div className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-2 px-8 lg:flex">
          <NotificationBell />
        </div>
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:pt-0 lg:pb-12">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
