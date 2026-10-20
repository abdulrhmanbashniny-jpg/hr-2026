import { ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperAdmin();
  const { t } = await getI18n();
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-sunken)' }}>
      <header className="app-topbar">
        <span className="flex items-center gap-2 font-display text-lg font-bold">
          <Shield size={20} />
          {t.meta.product} · {t.admin.title}
        </span>
        <Link href="/app" className="ui-btn ui-btn--ghost ui-btn--sm ms-auto">
          <ArrowRight size={16} className="ltr:rotate-180" />
          {t.nav.overview}
        </Link>
      </header>
      <main className="app-content" style={{ marginInline: 'auto' }}>
        <AdminNav
          items={[
            { href: '/admin', label: t.admin.tenants },
            { href: '/admin/plans', label: t.admin.plans },
            { href: '/admin/promos', label: t.admin.promos },
            { href: '/admin/payments', label: t.admin.payments },
            { href: '/admin/system', label: t.admin.telegram },
          ]}
        />
        {children}
      </main>
    </div>
  );
}
