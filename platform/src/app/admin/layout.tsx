import { count, eq } from 'drizzle-orm';
import { Building2, CreditCard, Gauge, Inbox, Megaphone, Package, ScrollText, ServerCog, TicketPercent, UserCog, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { AdminTopbar } from '@/components/admin/admin-topbar';
import { DesignerCredit } from '@/components/app/credit';
import { AppShell } from '@/components/app/shell';
import { Sidebar, type NavGroup } from '@/components/app/sidebar';
import { db } from '@/db';
import { contactMessages, payments, tenants, users } from '@/db/schema';
import { staffCan, type StaffPermission } from '@/lib/admin/staff';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireSuperAdmin();
  const { t } = await getI18n();
  const c = t.console.nav;
  const [[tenantN], [userN], [pendingN], [inboxN]] = await Promise.all([
    db.select({ n: count() }).from(tenants),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(payments).where(eq(payments.status, 'pending')),
    db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.status, 'new')),
  ]);
  const i = { size: 18, strokeWidth: 1.9 };
  const role = s.user.staffRole;
  const allowed = (perm: StaffPermission) => staffCan(role, perm);
  type Item = NavGroup['items'][number] & { perm?: StaffPermission };
  const all: { label?: string; items: Item[] }[] = [
    { items: [{ href: '/admin', label: c.overview, icon: <Gauge {...i} />, exact: true }] },
    {
      label: c.groupCustomers,
      items: [
        { href: '/admin/tenants', label: c.tenants, icon: <Building2 {...i} />, count: tenantN.n, perm: 'tenants:view' },
        { href: '/admin/users', label: c.users, icon: <Users {...i} />, count: userN.n, perm: 'users:view' },
        { href: '/admin/inbox', label: c.inbox, icon: <Inbox {...i} />, count: inboxN.n || undefined, countTone: 'alert', perm: 'inbox:view' },
        { href: '/admin/messages', label: c.messages, icon: <Megaphone {...i} />, perm: 'messages:send' },
      ],
    },
    {
      label: c.groupBilling,
      items: [
        { href: '/admin/plans', label: c.plans, icon: <Package {...i} />, perm: 'billing:manage' },
        { href: '/admin/promos', label: c.promos, icon: <TicketPercent {...i} />, perm: 'billing:manage' },
        { href: '/admin/payments', label: c.payments, icon: <CreditCard {...i} />, count: pendingN.n, countTone: 'alert', perm: 'billing:manage' },
      ],
    },
    {
      label: c.groupPlatform,
      items: [
        { href: '/admin/team', label: c.team, icon: <UserCog {...i} />, perm: 'team:manage' },
        { href: '/admin/audit', label: c.audit, icon: <ScrollText {...i} />, perm: 'audit:view' },
        { href: '/admin/system', label: c.system, icon: <ServerCog {...i} />, perm: 'system:manage' },
      ],
    },
  ];
  const groups: NavGroup[] = all
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.perm || allowed(it.perm)).map(({ perm: _perm, ...it }) => it) }))
    .filter((g) => g.items.length);
  return (
    <AppShell sidebar={<Sidebar product={t.meta.product} tenantName={t.console.name} groups={groups} home="/admin" />}>
      <AdminTopbar user={{ name: s.user.name, email: s.user.email }} hasWorkspace={s.memberships.length > 0} role={role} inboxNew={allowed('inbox:view') ? inboxN.n : null} />
      <main className="app-content">{children}</main>
      <DesignerCredit />
    </AppShell>
  );
}
