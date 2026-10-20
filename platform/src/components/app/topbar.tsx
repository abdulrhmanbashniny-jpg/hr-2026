'use client';

import { Bell, Building2, Check, ChevronDown, Languages, LogOut, Menu, Monitor, Moon, Settings, Shield, Sun, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { setLocale, setTheme, switchTenant } from '@/app/actions/preferences';
import { signOut } from '@/app/actions/auth';
import { useI18n } from '@/lib/i18n/client';
import { useNav } from './shell';

export function Dropdown({ label, icon, children, ariaLabel, trigger = 'ghost' }: { label?: ReactNode; icon: ReactNode; children: (close: () => void) => ReactNode; ariaLabel?: string; trigger?: 'ghost' | 'avatar' }) {
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
      <button
        type="button"
        className={trigger === 'avatar' ? 'flex items-center gap-2 rounded-full border-0 bg-transparent p-1 pe-2 cursor-pointer hover:bg-[var(--surface-muted)]' : 'ui-btn ui-btn--ghost ui-btn--sm'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {label ? <span className="hide-sm max-w-[180px] truncate">{label}</span> : null}
        {trigger === 'avatar' ? <ChevronDown size={14} className="hide-sm" style={{ color: 'var(--muted)' }} /> : null}
      </button>
      {open ? (
        <div className="ui-menu" role="menu">
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

const ENTITY_WORDS = new Set(['شركة', 'شركه', 'مؤسسة', 'مجموعة', 'مصنع', 'مكتب', 'مستشفى']);

/** One letter for Arabic names (skipping "شركة"/"مؤسسة" and the article), two initials for Latin ones. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (/[\u0600-\u06FF]/.test(name)) {
    const word = parts.find((p) => !ENTITY_WORDS.has(p)) ?? parts[0] ?? '?';
    return word.replace(/^(ال|لل)/, '').charAt(0) || word.charAt(0);
  }
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** Two gradient stops picked from the name, so each person keeps the same avatar colours. */
export function avatarStyle(seed: string) {
  const pairs = [
    ['#5ac8fa', '#007aff'],
    ['#7d7aff', '#5e5ce6'],
    ['#64d2ff', '#30b0c7'],
    ['#30d158', '#34c759'],
    ['#ffb340', '#ff9500'],
    ['#ff6482', '#ff2d55'],
    ['#da8fff', '#af52de'],
  ];
  let h = 0;
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = pairs[h % pairs.length];
  return { '--av-a': a, '--av-b': b } as React.CSSProperties;
}

export function Avatar({ name, size }: { name: string; size?: 'lg' }) {
  return (
    <span className={`ui-avatar ${size === 'lg' ? 'ui-avatar--lg' : ''}`} style={avatarStyle(name)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function LocaleButton() {
  const { t, locale } = useI18n();
  const [, start] = useTransition();
  return (
    <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => start(() => setLocale(locale === 'ar' ? 'en' : 'ar'))} lang={locale === 'ar' ? 'en' : 'ar'} title={t.common.language}>
      <Languages size={16} />
      <span className="hide-sm">{locale === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}

export function ThemeMenu() {
  const { t } = useI18n();
  const [, start] = useTransition();
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    const resolved = theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', resolved);
    start(() => setTheme(theme));
  };
  return (
    <Dropdown icon={<Sun size={16} />} ariaLabel={t.common.theme}>
      {(close) =>
        (
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
        ))
      }
    </Dropdown>
  );
}

export function UserMenu({ user, links }: { user: { name: string; email: string }; links?: { href: string; label: string; icon: ReactNode }[] }) {
  const { t } = useI18n();
  return (
    <Dropdown trigger="avatar" icon={<Avatar name={user.name} />} label={user.name} ariaLabel={user.name}>
      {() => (
        <>
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={user.name} />
            <div className="min-w-0 text-sm">
              <div className="truncate font-semibold">{user.name}</div>
              <div className="ltr truncate text-muted">{user.email}</div>
            </div>
          </div>
          <hr />
          {links?.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem">
              {l.icon}
              {l.label}
            </Link>
          ))}
          {links?.length ? <hr /> : null}
          <form action={signOut}>
            <button type="submit" role="menuitem" className="is-danger">
              <LogOut size={16} />
              {t.common.signOut}
            </button>
          </form>
        </>
      )}
    </Dropdown>
  );
}

export function Topbar({ user, tenantId, memberships, unread, isSuperAdmin }: { user: { name: string; email: string }; tenantId: string; memberships: { tenantId: string; tenantName: string }[]; unread: number; isSuperAdmin: boolean }) {
  const { t } = useI18n();
  const { setOpen } = useNav();
  const router = useRouter();
  const [, start] = useTransition();
  const current = memberships.find((m) => m.tenantId === tenantId);

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
      <div className="ms-auto flex items-center gap-1">
        {isSuperAdmin ? (
          <Link href="/admin" className="ui-btn ui-btn--ghost ui-btn--sm">
            <Shield size={16} />
            <span className="hide-sm">{t.nav.superAdmin}</span>
          </Link>
        ) : null}
        <Link href="/app/notifications" className="ui-btn ui-btn--ghost ui-btn--sm relative" aria-label={`${t.nav.notifications} (${unread})`}>
          <Bell size={16} />
          {unread ? (
            <span className="ui-num absolute -top-0.5 end-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: 'var(--exp-expired)' }}>
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
        <LocaleButton />
        <ThemeMenu />
        <UserMenu
          user={user}
          links={[
            { href: '/app/settings', label: t.nav.settings, icon: <Settings size={16} /> },
            { href: '/app/notifications', label: t.nav.notifications, icon: <UserRound size={16} /> },
          ]}
        />
      </div>
    </header>
  );
}
