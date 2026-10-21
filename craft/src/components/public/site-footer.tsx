import Link from 'next/link';
import { Logo } from '@/components/brand/icons';
import { getI18n } from '@/lib/i18n';
import { LanguageSwitch } from './language-switch';

export async function SiteFooter() {
  const { t } = await getI18n();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Logo name={t.meta.product} />
          <p className="max-w-md text-sm text-muted">{t.meta.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <Link href="/login" className="hover:text-ink">
            {t.common.signIn}
          </Link>
          <Link href="/#trust" className="hover:text-ink">
            {t.landing.trust.title}
          </Link>
          <LanguageSwitch />
          <span className="num">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
