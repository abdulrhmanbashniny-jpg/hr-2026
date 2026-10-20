import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandTile } from '@/components/ui/brand';
import { getI18n } from '@/lib/i18n';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getI18n();
  return (
    <main className="auth-wrap">
      <div className="auth-card flex flex-col gap-2">
        <Link href="/" className="auth-brand">
          <BrandTile size={56} />
          <span className="font-display text-2xl font-bold">{t.meta.product}</span>
          <span className="text-sm text-muted">{t.meta.tagline}</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
