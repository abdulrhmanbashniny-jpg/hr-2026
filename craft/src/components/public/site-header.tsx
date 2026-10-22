import { LayoutDashboard, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/icons';
import { getSession } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/roles';
import { getI18n } from '@/lib/i18n';
import { landingStrings } from '@/lib/i18n/pages/landing';
import { HeaderMenu, HeaderSearch } from './header-menu';
import { LanguageSwitch } from './language-switch';

/** The public header from the design: brand, section links, the two portals and the amber call to action. */
export async function SiteHeader({ search = true }: { search?: boolean }) {
  const { t, locale } = await getI18n();
  const s = landingStrings(locale);
  const session = await getSession().catch(() => null);
  const staff = session ? isStaff(session.user.role) : false;
  const portal = session ? (staff ? '/admin' : '/app') : null;
  const links = [
    { href: '/#top', label: s.header.nav.home },
    { href: '/#about', label: s.header.nav.about },
    { href: '/#how', label: s.header.nav.how },
    { href: '/#rewards', label: s.header.nav.rewards },
    { href: '/#products', label: s.header.nav.products },
    { href: '/#contact', label: s.header.nav.contact },
  ];
  return (
    <header className="sticky top-0 z-50 bg-surface-container-lowest/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-space-md px-margin-mobile lg:px-margin">
        <Link href="/" className="flex min-w-0 items-center gap-space-sm" aria-label={t.meta.product}>
          <LogoMark size={40} className="shrink-0" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-headline-sm tracking-tight text-primary">{t.meta.product}</span>
            <span className="hidden truncate text-body-sm text-on-surface-variant sm:inline">{t.meta.tagline}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label={s.header.menu}>
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-space-sm py-space-xs text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-space-xs">
          {search && <HeaderSearch />}
          <LanguageSwitch compact className="hidden sm:inline-flex" />
          <div className="hidden items-center gap-1 text-label-md lg:flex">
            <Link href={staff ? '/admin' : '/app'} className="rounded-lg px-space-sm py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
              {staff ? s.header.adminPortal : s.header.craftsmanPortal}
            </Link>
            {!session && (
              <Link href="/admin" className="rounded-lg px-space-sm py-space-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface">
                {s.header.adminPortal}
              </Link>
            )}
          </div>
          {portal ? (
            <Link href={portal} className="press amber-gradient inline-flex h-11 items-center gap-2 rounded-xl px-space-md text-label-lg text-primary-container shadow-md hover:brightness-105">
              <LayoutDashboard className="size-5" />
              <span className="hidden sm:inline">{staff ? s.header.console : s.header.myPortal}</span>
            </Link>
          ) : (
            <Link href="/#join" className="press amber-gradient inline-flex h-11 items-center gap-2 rounded-xl px-space-md text-label-lg text-primary-container shadow-md hover:brightness-105">
              <UserPlus className="size-5" />
              <span className="hidden sm:inline">{s.header.cta}</span>
            </Link>
          )}
          <HeaderMenu links={links} portals={[{ href: '/app', label: s.header.craftsmanPortal }, { href: '/admin', label: s.header.adminPortal }]} />
        </div>
      </div>
    </header>
  );
}
