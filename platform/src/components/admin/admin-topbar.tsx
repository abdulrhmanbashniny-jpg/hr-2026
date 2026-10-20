'use client';

import { Inbox, LayoutGrid, Menu, Shield } from 'lucide-react';
import Link from 'next/link';
import { LocaleButton, ThemeMenu, UserMenu } from '@/components/app/topbar';
import { useNav } from '@/components/app/shell';
import type { StaffRole } from '@/lib/admin/staff';
import { useI18n } from '@/lib/i18n/client';

export function AdminTopbar({ user, hasWorkspace, role, inboxNew }: { user: { name: string; email: string }; hasWorkspace: boolean; role: StaffRole | null; inboxNew: number | null }) {
  const { t } = useI18n();
  const { setOpen } = useNav();
  return (
    <header className="app-topbar">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon mobile-nav-toggle" aria-label={t.nav.menu} onClick={() => setOpen(true)}>
        <Menu />
      </button>
      <span className="app-topbar__title">
        <Shield size={17} style={{ color: 'var(--accent)' }} />
        <span className="truncate">{t.console.name}</span>
        {role && role !== 'owner' ? <span className="ui-pill ui-pill--gray hide-sm">{t.console.team.roles[role]}</span> : null}
      </span>
      <div className="ms-auto flex items-center gap-1">
        {hasWorkspace ? (
          <Link href="/app" className="ui-btn ui-btn--ghost ui-btn--sm">
            <LayoutGrid size={16} />
            <span className="hide-sm">{t.console.nav.myWorkspace}</span>
          </Link>
        ) : null}
        {inboxNew !== null ? (
          <Link href="/admin/inbox?s=new" className="ui-btn ui-btn--ghost ui-btn--icon relative" aria-label={`${t.console.nav.inbox}${inboxNew ? ` (${inboxNew})` : ''}`} title={t.console.nav.inbox}>
            <Inbox size={19} />
            {inboxNew ? (
              <span className="ui-num absolute -top-0.5 end-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: 'var(--exp-expired)' }}>
                {inboxNew > 99 ? '99+' : inboxNew}
              </span>
            ) : null}
          </Link>
        ) : null}
        <LocaleButton />
        <ThemeMenu />
        <UserMenu user={user} links={hasWorkspace ? [{ href: '/app', label: t.console.nav.myWorkspace, icon: <LayoutGrid size={16} /> }] : []} />
      </div>
    </header>
  );
}
