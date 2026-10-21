'use client';

import { Bell, Gift, House, IdCard, Images, LogOut, Menu, Receipt, ScanLine, UserRound, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/brand/icons';
import { LanguageSwitch } from '@/components/public/language-switch';
import { Avatar } from '@/components/ui/avatar';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { fmtCode } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { NotificationBell } from './notification-bell';

export interface ShellUser {
  name: string;
  code: string;
  tier: 'A' | 'B' | 'C';
}

function useNav() {
  const { t } = useI18n();
  return [
    { href: '/app', label: t.nav.home, icon: House },
    { href: '/app/card', label: t.nav.card, icon: IdCard },
    { href: '/app/invoices', label: t.nav.invoices, icon: Receipt },
    { href: '/app/portfolio', label: t.nav.portfolio, icon: Images },
    { href: '/app/rewards', label: t.nav.rewards, icon: Gift },
    { href: '/app/referrals', label: t.nav.referrals, icon: Users },
    { href: '/app/profile', label: t.nav.profile, icon: UserRound },
  ];
}

const isActive = (path: string, href: string) => (href === '/app' ? path === '/app' : path.startsWith(href));

async function signOut(router: ReturnType<typeof useRouter>) {
  await api('/auth/logout', { body: {} }).catch(() => undefined);
  router.replace('/');
  router.refresh();
}

export function Sidebar({ user }: { user: ShellUser }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const nav = useNav();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface px-4 py-5 lg:flex">
      <Link href="/app" className="px-2">
        <Logo name={t.meta.product} />
      </Link>
      <Link href="/app/invoices/scan" className="amber-gradient press mt-6 flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-accent-ink shadow-sm hover:shadow-glow">
        <ScanLine className="size-5" />
        {t.nav.scan}
      </Link>
      <nav className="mt-6 flex flex-col gap-1">
        {nav.map((n) => {
          const active = isActive(path, n.href);
          return (
            <Link key={n.href} href={n.href} className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition', active ? 'font-semibold text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
              {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-surface-2" />}
              <n.icon className="relative size-5" />
              <span className="relative">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 border-t border-line pt-4">
        <div className="flex items-center gap-3 px-2">
          <Avatar name={user.name} size={38} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
            <div className="num text-xs text-muted">{fmtCode(user.code)}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <LanguageSwitch />
          <button onClick={() => signOut(router)} className="press inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-muted hover:bg-surface-2 hover:text-danger">
            <LogOut className="size-4" />
            {t.common.signOut}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar({ user }: { user: ShellUser }) {
  const { t } = useI18n();
  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center justify-between border-x-0 border-t-0 px-4 pt-[env(safe-area-inset-top)] lg:hidden">
      <Link href="/app">
        <Logo name={t.meta.product} />
      </Link>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Link href="/app/profile" aria-label={t.nav.profile}>
          <Avatar name={user.name} size={32} className="rounded-xl" />
        </Link>
      </div>
    </header>
  );
}

export function TabBar() {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const nav = useNav();
  const [more, setMore] = useState(false);
  const tabs = [nav[0], nav[2], null, nav[4], { href: '#more', label: t.common.viewAll, icon: Menu }];
  return (
    <>
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid h-16 grid-cols-5 items-center">
          {tabs.map((n, i) =>
            n === null ? (
              <div key="scan" className="flex justify-center">
                <Link href="/app/invoices/scan" aria-label={t.nav.scan} className="amber-gradient press -mt-7 grid size-14 place-items-center rounded-2xl text-accent-ink shadow-glow ring-4 ring-canvas">
                  <ScanLine className="size-6" />
                </Link>
              </div>
            ) : (
              <Link
                key={n.href}
                href={n.href === '#more' ? '#' : n.href}
                onClick={(e) => {
                  if (n.href === '#more') {
                    e.preventDefault();
                    setMore(true);
                  }
                }}
                className={cn('flex flex-col items-center gap-0.5 text-[11px]', n.href !== '#more' && isActive(path, n.href) ? 'font-semibold text-ink' : 'text-muted')}
              >
                <n.icon className="size-[22px]" />
                {n.label}
              </Link>
            ),
          )}
        </div>
      </nav>
      <Dialog open={more} onClose={() => setMore(false)} title={t.meta.product}>
        <div className="grid grid-cols-3 gap-2">
          {[nav[1], nav[3], nav[5], nav[6], { href: '/app/notifications', label: t.nav.notifications, icon: Bell }].map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMore(false)} className="press flex flex-col items-center gap-2 rounded-2xl border border-line p-4 text-sm text-ink-2 hover:bg-surface-2">
              <n.icon className="size-6 text-ink" />
              {n.label}
            </Link>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <LanguageSwitch />
          <button onClick={() => signOut(router)} className="inline-flex items-center gap-1.5 text-sm text-danger">
            <LogOut className="size-4" />
            {t.common.signOut}
          </button>
        </div>
      </Dialog>
    </>
  );
}
