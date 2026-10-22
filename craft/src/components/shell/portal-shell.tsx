'use client';

import {
  BadgeCheck,
  Bell,
  ChartColumn,
  FileSpreadsheet,
  Gift,
  Globe,
  IdCard,
  Images,
  LayoutDashboard,
  KeyRound,
  LogOut,
  Map as MapIcon,
  Megaphone,
  Menu,
  MessageSquareQuote,
  PaintBucket,
  Receipt,
  ScanLine,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LogoMark } from '@/components/brand/icons';
import { LanguageSwitch } from '@/components/public/language-switch';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/client';

const ICONS = {
  card: IdCard,
  dashboard: LayoutDashboard,
  invoices: Receipt,
  portfolio: Images,
  rewards: Trophy,
  gift: Gift,
  referrals: Users,
  profile: UserRound,
  notifications: Bell,
  site: Globe,
  verification: BadgeCheck,
  fraud: ShieldAlert,
  incentives: Megaphone,
  dealers: Store,
  map: MapIcon,
  reports: FileSpreadsheet,
  settings: SlidersHorizontal,
  reviews: MessageSquareQuote,
  products: PaintBucket,
  chart: ChartColumn,
} as const;

export type ShellIcon = keyof typeof ICONS;

export interface ShellItem {
  href: string;
  label: string;
  icon: ShellIcon;
  badge?: number;
}

export interface ShellProps {
  items: ShellItem[];
  /** Strapline under the product name in the sidebar ("بوابة الأعضاء المحترفين"). */
  portalName: string;
  user: { name: string; avatarUrl?: string | null; subtitle: string; href?: string };
  /** The card at the foot of the sidebar ("الحالة المهنية · معتمد - فئة أ"). */
  status: { label: string; value: string };
  cta?: { href: string; label: string };
  search: { placeholder: string; scope: 'member' | 'console' };
  bell?: ReactNode;
  /** Mobile bottom tabs (craftsman app). */
  tabs?: ShellItem[];
  children: ReactNode;
}

function isActive(path: string, href: string, root: string) {
  return href === root ? path === root : path === href || path.startsWith(`${href}/`);
}

async function signOut(router: ReturnType<typeof useRouter>) {
  await api('/auth/logout', { body: {} }).catch(() => undefined);
  navigator.serviceWorker?.controller?.postMessage({ type: 'logout' });
  router.replace('/');
  router.refresh();
}

function NavList({ items, root, onNavigate }: { items: ShellItem[]; root: string; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((n) => {
        const active = n.href !== '/' && isActive(path, n.href, root);
        const Icon = ICONS[n.icon];
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn('relative flex items-center gap-space-sm rounded-xl px-space-md py-2.5 transition-colors', active ? 'font-semibold text-white' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface')}
          >
            {active && <motion.span layoutId="shell-active" className="absolute inset-0 rounded-xl bg-primary-container shadow-sm" transition={{ type: 'spring', stiffness: 300, damping: 25 }} />}
            <Icon className={cn('relative size-5', active && 'text-secondary-fixed-dim')} />
            <span className="relative flex-1 text-label-lg">{n.label}</span>
            {!!n.badge && <span className="num relative min-w-5 rounded-full bg-secondary-container px-1.5 text-center text-label-sm text-on-secondary-fixed">{n.badge > 99 ? '99+' : n.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ items, root, portalName, status, cta, onNavigate }: Pick<ShellProps, 'items' | 'portalName' | 'status' | 'cta'> & { root: string; onNavigate?: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div className="flex h-full flex-col pt-space-md pb-space-lg">
      <Link href={root} onClick={onNavigate} className="mb-space-lg flex items-center gap-space-sm px-space-md">
        <LogoMark size={40} className="shrink-0" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-headline-sm text-primary-container">{t.meta.product}</span>
          <span className="truncate text-label-sm text-on-surface-variant">{portalName}</span>
        </div>
      </Link>
      {cta && (
        <div className="mb-space-md px-space-sm">
          <Link href={cta.href} onClick={onNavigate} className="amber-gradient press flex h-12 items-center justify-center gap-2 rounded-xl text-label-lg text-primary-container shadow-md hover:brightness-105">
            <ScanLine className="size-5" />
            {cta.label}
          </Link>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-space-sm">
        <NavList items={items} root={root} onNavigate={onNavigate} />
      </div>
      <div className="space-y-space-sm px-space-md pt-space-sm">
        <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-space-sm ps-space-md shadow-sm">
          <div className="flex min-w-0 flex-col">
            <span className="text-label-sm text-on-surface-variant">{status.label}</span>
            <span className="truncate text-label-md font-bold text-secondary">{status.value}</span>
          </div>
          <BadgeCheck className="size-6 shrink-0 text-secondary" />
        </div>
        <div className="flex items-center justify-between">
          <LanguageSwitch />
          <div className="flex items-center gap-0.5">
            <Link
              href="/account/password"
              onClick={onNavigate}
              aria-label={t.auth.changeTitle}
              title={t.auth.changeTitle}
              className="press grid size-9 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-primary"
            >
              <KeyRound className="size-4" />
            </Link>
            <button onClick={() => signOut(router)} className="press inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-label-md text-on-surface-variant hover:bg-error-container hover:text-error">
              <LogOut className="size-4" />
              {t.common.signOut}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopSearch({ placeholder, scope }: ShellProps['search']) {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="flex min-w-0 flex-1 items-center gap-space-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (!v) return;
        const digits = v.replace(/\D/g, '');
        if (scope === 'console') router.push(`/admin/craftsmen?q=${encodeURIComponent(v)}`);
        else if (digits.length >= 6) router.push(`/c/${digits}`);
        setQ('');
      }}
    >
      <Search className="size-5 shrink-0 text-on-surface-variant" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 w-full max-w-sm min-w-0 bg-transparent text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
    </form>
  );
}

/**
 * The signed-in shell from the design: a fixed sidebar on the reading-start side, a translucent top
 * bar with search, notifications and the user's photo, and on phones a drawer plus bottom tabs.
 */
export function PortalShell({ items, portalName, user, status, cta, search, bell, tabs, children }: ShellProps) {
  const { t } = useI18n();
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const root = items[0]?.href ?? '/';
  useEffect(() => setDrawer(false), [path]);

  return (
    <div className="min-h-dvh bg-surface">
      <aside className="fixed inset-y-0 start-0 z-50 hidden w-72 bg-surface-container-low shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:block">
        <SidebarBody items={items} root={root} portalName={portalName} status={status} cta={cta} />
      </aside>

      <AnimatePresence>
        {drawer && (
          <>
            <motion.div key="scrim" className="fixed inset-0 z-50 bg-primary-container/40 backdrop-blur-[4px] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)} />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 start-0 z-50 w-[min(18rem,85vw)] bg-surface-container-low shadow-lg lg:hidden"
              initial={{ x: t.meta.dir === 'rtl' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: t.meta.dir === 'rtl' ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <button onClick={() => setDrawer(false)} aria-label={t.common.close} className="absolute top-4 end-3 grid size-9 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container-high">
                <X className="size-5" />
              </button>
              <SidebarBody items={items} root={root} portalName={portalName} status={status} cta={cta} onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-space-md bg-surface/85 px-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md lg:start-72 lg:px-space-lg">
        <button onClick={() => setDrawer(true)} aria-label={t.common.menu} className="grid size-10 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container-high lg:hidden">
          <Menu className="size-5" />
        </button>
        <Link href={root} className="flex shrink-0 items-center gap-2 lg:hidden">
          <LogoMark size={32} />
        </Link>
        <div className="hidden min-w-0 flex-1 sm:flex">
          <TopSearch {...search} />
        </div>
        <div className="flex shrink-0 items-center gap-space-md">
          {bell}
          <div className="h-4 w-px bg-surface-variant" />
          <Link href={user.href ?? root} className="flex items-center gap-space-sm" aria-label={user.name}>
            <span className="hidden flex-col text-end leading-tight md:flex">
              <span className="text-label-md font-semibold text-on-surface">{user.name}</span>
              <span className="text-label-sm text-on-surface-variant">{user.subtitle}</span>
            </span>
            <Avatar name={user.name} src={user.avatarUrl} size={34} className="rounded-full" />
          </Link>
        </div>
      </header>

      <div className="lg:ps-72">
        <main className={cn('relative mx-auto min-h-dvh w-full max-w-[1280px] px-margin-mobile pt-[calc(4rem+1.5rem)] lg:px-space-lg', tabs ? 'pb-28 lg:pb-space-xl' : 'pb-space-xl')}>{children}</main>
      </div>

      {tabs && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-container-lowest/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          <div className="grid h-16 grid-cols-5 items-center">
            {tabs.slice(0, 2).map((n) => (
              <Tab key={n.href} item={n} root={root} />
            ))}
            <div className="flex justify-center">
              {cta && (
                <Link href={cta.href} aria-label={cta.label} className="amber-gradient press -mt-7 grid size-14 place-items-center rounded-2xl text-primary-container shadow-lg ring-4 ring-surface">
                  <ScanLine className="size-6" />
                </Link>
              )}
            </div>
            {tabs.slice(2, 4).map((n) => (
              <Tab key={n.href} item={n} root={root} />
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function Tab({ item, root }: { item: ShellItem; root: string }) {
  const path = usePathname();
  const Icon = ICONS[item.icon];
  const active = isActive(path, item.href, root);
  return (
    <Link href={item.href} className={cn('flex flex-col items-center gap-0.5 text-[11px]', active ? 'font-semibold text-primary-container' : 'text-on-surface-variant')}>
      <Icon className={cn('size-[22px]', active && 'text-secondary')} />
      {item.label}
    </Link>
  );
}
