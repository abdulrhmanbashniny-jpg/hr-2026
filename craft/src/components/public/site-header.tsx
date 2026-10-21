import Link from 'next/link';
import { Logo } from '@/components/brand/icons';
import { ButtonLink } from '@/components/ui/button';
import { getSession } from '@/lib/auth/session';
import { isStaff } from '@/lib/auth/roles';
import { getI18n } from '@/lib/i18n';
import { LanguageSwitch } from './language-switch';
import { UniversalSearch } from './universal-search';

export async function SiteHeader({ search = true }: { search?: boolean }) {
  const { t } = await getI18n();
  const s = await getSession().catch(() => null);
  const home = s ? (isStaff(s.user.role) ? '/admin' : '/app') : null;
  return (
    <header className="glass sticky top-0 z-50 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label={t.meta.product} className="shrink-0">
          <Logo name={t.meta.product} />
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-ink-2 lg:flex">
          <a href="/#how" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">
            {t.nav.howItWorks}
          </a>
          <a href="/#audiences" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">
            {t.nav.forBrands}
          </a>
          <a href="/#trust" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">
            {t.nav.forClients}
          </a>
        </nav>
        <div className="ms-auto hidden w-64 md:block">{search && <UniversalSearch size="sm" />}</div>
        <div className="ms-auto flex items-center gap-1.5 md:ms-0">
          <LanguageSwitch compact className="hidden sm:inline-flex" />
          {home ? (
            <ButtonLink href={home} size="sm">
              {isStaff(s!.user.role) ? t.nav.console : t.nav.home}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                {t.common.signIn}
              </ButtonLink>
              <ButtonLink href="/login?join=1" variant="accent" size="sm">
                {t.common.join}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
