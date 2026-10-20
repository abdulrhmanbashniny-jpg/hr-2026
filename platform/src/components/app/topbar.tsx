'use client';

import { Bell, Building2, Check, Languages, LogOut, Menu, Monitor, Moon, Shield, Sun, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { setLocale, setTheme, switchTenant } from '@/app/actions/preferences';
import { signOut } from '@/app/actions/auth';
import { useI18n } from '@/lib/i18n/client';
import { useNav } from './shell';

function Dropdown({ label, icon, children }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}
        <span className="hide-sm">{label}</span>
      </button>
      {open ? (
        <div className="ui-menu" role="menu">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({ user, tenantId, memberships, unread, isSuperAdmin }: { user: { name: string; email: string }; tenantId: string; memberships: { tenantId: string; tenantName: string }[]; unread: number; isSuperAdmin: boolean }) {
  const { t, locale } = useI18n();
  const { setOpen } = useNav();
  const router = useRouter();
  const [, start] = useTransition();
  const current = memberships.find((m) => m.tenantId === tenantId);

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', resolved);
    start(() => setTheme(theme));
  };

  return (
    <header className="app-topbar">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon mobile-nav-toggle" aria-label={t.nav.menu} onClick={() => setOpen(true)}>
        <Menu />
      </button>
      {memberships.length > 1 ? (
        <Dropdown label={current?.tenantName ?? ''} icon={<Building2 size={16} />}>
          {(close) =>
            memberships.map((m) => (
              <button
                key={m.tenantId}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  start(async () => {
                    await switchTenant(m.tenantId);
                    router.push('/app');
                  });
                }}
              >
                {m.tenantId === tenantId ? <Check size={16} /> : <span style={{ width: 16 }} />}
                {m.tenantName}
              </button>
            ))
          }
        </Dropdown>
      ) : null}
      <div className="ms-auto flex items-center gap-2">
        {isSuperAdmin ? (
          <Link href="/admin" className="ui-btn ui-btn--ghost ui-btn--sm">
            <Shield size={16} />
            <span className="hide-sm">{t.nav.superAdmin}</span>
          </Link>
        ) : null}
        <Link href="/app/notifications" className="ui-btn ui-btn--ghost ui-btn--sm" aria-label={`${t.nav.notifications} (${unread})`}>
          <Bell size={16} />
          {unread ? <span className="ui-num font-semibold">{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => start(() => setLocale(locale === 'ar' ? 'en' : 'ar'))} lang={locale === 'ar' ? 'en' : 'ar'}>
          <Languages size={16} />
          <span className="hide-sm">{t.common.language}</span>
        </button>
        <Dropdown label="" icon={<Sun size={16} />}>
          {(close) => (
            <>
              {(
                [
                  ['light', t.common.themeLight, <Sun key="s" size={16} />],
                  ['dark', t.common.themeDark, <Moon key="m" size={16} />],
                  ['system', t.common.themeSystem, <Monitor key="d" size={16} />],
                ] as const
              ).map(([k, label, icon]) => (
                <button
                  key={k}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    close();
                    applyTheme(k);
                  }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </>
          )}
        </Dropdown>
        <Dropdown label={user.name} icon={<UserRound size={16} />}>
          {() => (
            <>
              <div className="px-2.5 py-2 text-sm">
                <div className="font-semibold">{user.name}</div>
                <div className="text-muted ltr">{user.email}</div>
              </div>
              <form action={signOut}>
                <button type="submit" role="menuitem">
                  <LogOut size={16} />
                  {t.common.signOut}
                </button>
              </form>
            </>
          )}
        </Dropdown>
      </div>
    </header>
  );
}
