'use client';

import { BadgeCheck, ChartColumn, ExternalLink, FileSpreadsheet, Gift, LayoutDashboard, LogOut, Map as MapIcon, Megaphone, Receipt, ShieldAlert, SlidersHorizontal, Store, Users } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/brand/icons';
import { LanguageSwitch } from '@/components/public/language-switch';
import { Dialog } from '@/components/ui/dialog';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/client';
import { useConsole } from './console-i18n';

export interface ConsoleNavItem {
  href: string;
  key: 'overview' | 'invoices' | 'craftsmen' | 'verification' | 'fraud' | 'incentives' | 'rewards' | 'dealers' | 'map' | 'reports' | 'settings';
  badge?: number;
}

const ICONS = {
  overview: LayoutDashboard,
  invoices: Receipt,
  craftsmen: Users,
  verification: BadgeCheck,
  fraud: ShieldAlert,
  incentives: Megaphone,
  rewards: Gift,
  dealers: Store,
  map: MapIcon,
  reports: FileSpreadsheet,
  settings: SlidersHorizontal,
} as const;

function Items({ items, onNavigate }: { items: ConsoleNavItem[]; onNavigate?: () => void }) {
  const c = useConsole();
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
        const Icon = ICONS[n.key];
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate} className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition', active ? 'font-semibold text-white' : 'text-white/65 hover:bg-white/5 hover:text-white')}>
            {active && <motion.span layoutId="console-active" className="absolute inset-0 rounded-xl bg-white/10" />}
            <Icon className="relative size-[18px]" />
            <span className="relative flex-1">{c.nav[n.key]}</span>
            {!!n.badge && <span className="num relative rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">{n.badge > 99 ? '99+' : n.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function ConsoleSidebar({ items, user }: { items: ConsoleNavItem[]; user: { name: string; role: string } }) {
  const { t } = useI18n();
  const c = useConsole();
  const router = useRouter();
  return (
    <aside className="navy-gradient sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto px-3 py-5 text-white lg:flex">
      <Link href="/admin" className="flex items-center gap-2 px-3">
        <Logo name="" />
        <div className="leading-tight">
          <div className="font-bold">{t.meta.product}</div>
          <div className="text-[11px] text-white/60">{c.title}</div>
        </div>
      </Link>
      <div className="mt-6 flex-1">
        <Items items={items} />
      </div>
      <div className="space-y-2 border-t border-white/10 px-2 pt-4">
        <div className="text-sm font-semibold">{user.name}</div>
        <div className="text-xs text-white/60">{user.role}</div>
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <LanguageSwitch className="text-white/75 hover:bg-white/10 hover:text-white" />
          <Link href="/" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white">
            <ExternalLink className="size-4" />
            {c.nav.backToSite}
          </Link>
          <button
            onClick={async () => {
              await api('/auth/logout', { body: {} }).catch(() => undefined);
              navigator.serviceWorker?.controller?.postMessage({ type: 'logout' });
              router.replace('/');
              router.refresh();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-white/75 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            {t.common.signOut}
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ConsoleMobileBar({ items }: { items: ConsoleNavItem[] }) {
  const { t } = useI18n();
  const c = useConsole();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="navy-gradient sticky top-0 z-40 flex h-14 items-center justify-between px-4 text-white lg:hidden">
        <span className="flex items-center gap-2 font-bold">
          <ChartColumn className="size-5 text-accent-2" />
          {t.meta.product} · {c.title}
        </span>
        <button onClick={() => setOpen(true)} className="rounded-lg px-3 py-1.5 text-sm hover:bg-white/10">
          {t.common.viewAll}
        </button>
      </header>
      <Dialog open={open} onClose={() => setOpen(false)} title={c.title}>
        <div className="navy-gradient -m-5 p-4">
          <Items items={items} onNavigate={() => setOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}
