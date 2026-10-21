import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/icons';
import { LanguageSwitch } from '@/components/public/language-switch';
import { getI18n } from '@/lib/i18n';

export async function AuthShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/">
            <Logo name={t.meta.product} />
          </Link>
          <LanguageSwitch />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <div className="navy-gradient grain relative hidden overflow-hidden lg:block">
        <div className="pattern-grid absolute inset-0 opacity-60" />
        <div className="absolute -end-32 -top-32 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,.3),transparent_65%)]" />
        <div className="relative flex h-full items-center justify-center p-12">{aside}</div>
      </div>
    </div>
  );
}
