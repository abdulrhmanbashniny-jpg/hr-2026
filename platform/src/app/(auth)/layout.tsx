import Link from 'next/link';
import type { ReactNode } from 'react';
import { getI18n } from '@/lib/i18n';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getI18n();
  return (
    <main className="auth-wrap">
      <div className="auth-card flex flex-col gap-5">
        <Link href="/" className="text-center" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
          <span className="font-display text-3xl font-bold">{t.meta.product}</span>
          <span className="mt-1 block text-sm text-muted">{t.meta.tagline}</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
