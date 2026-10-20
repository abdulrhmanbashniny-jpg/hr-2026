import { count, eq } from 'drizzle-orm';
import { Building2, CreditCard, Gauge, Megaphone, Package, ScrollText, ServerCog, TicketPercent, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { AppShell } from '@/components/app/shell';
import { Sidebar, type NavGroup } from '@/components/app/sidebar';
import { db } from '@/db';
import { payments, tenants, users } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireSuperAdmin();
  const { t } = await getI18n();
  const c = t.console.nav;
  const [[tenantN], [userN], [pendingN]] = await Promise.all([
    db.select({ n: count() }).from(tenants),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(payments).where(eq(payments.status, 'pending')),
  ]);
  const i = { size: 18, strokeWidth: 1.9 };
  const groups: NavGroup[] = [
    { items: [{ href: '/admin', label: c.overview, icon: <Gauge {...i} />, exact: true }] },
    {
      label: c.groupCustomers,
      items: [
        { href: '/admin/tenants', label: c.tenants, icon: <Building2 {...i} />, count: tenantN.n },
        { href: '/admin/users', label: c.users, icon: <Users {...i} />, count: userN.n },
        { href: '/admin/messages', label: c.messages, icon: <Megaphone {...i} /> },
      ],
    },
    {
      label: c.groupBilling,
      items: [
        { href: '/admin/plans', label: c.plans, icon: <Package {...i} /> },
        { href: '/admin/promos', label: c.promos, icon: <TicketPercent {...i} /> },
        { href: '/admin/payments', label: c.payments, icon: <CreditCard {...i} />, count: pendingN.n, countTone: 'alert' },
      ],
    },
    {
      label: c.groupPlatform,
      items: [
        { href: '/admin/audit', label: c.audit, icon: <ScrollText {...i} /> },
        { href: '/admin/system', label: c.system, icon: <ServerCog {...i} /> },
      ],
    },
  ];
  return (
    <AppShell sidebar={<Sidebar product={t.meta.product} tenantName={t.console.name} groups={groups} home="/admin" />}>
      <AdminTopbar user={{ name: s.user.name, email: s.user.email }} hasWorkspace={s.memberships.length > 0} />
      <main className="app-content">{children}</main>
    </AppShell>
  );
}
