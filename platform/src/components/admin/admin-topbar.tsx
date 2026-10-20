'use client';

import { LayoutGrid, Menu, Shield } from 'lucide-react';
import Link from 'next/link';
import { LocaleButton, ThemeMenu, UserMenu } from '@/components/app/topbar';
import { useNav } from '@/components/app/shell';
import type { StaffRole } from '@/lib/admin/staff';
import { useI18n } from '@/lib/i18n/client';

export function AdminTopbar({ user, hasWorkspace, role }: { user: { name: string; email: string }; hasWorkspace: boolean; role: StaffRole | null }) {
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
        <LocaleButton />
        <ThemeMenu />
        <UserMenu user={user} links={hasWorkspace ? [{ href: '/app', label: t.console.nav.myWorkspace, icon: <LayoutGrid size={16} /> }] : []} />
      </div>
    </header>
  );
}
