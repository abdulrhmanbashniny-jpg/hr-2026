import { and, count, eq, isNull } from 'drizzle-orm';
import { LifeBuoy } from 'lucide-react';
import {
  Bell,
  BellRing,
  Car,
  CreditCard,
  FileText,
  IdCard,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Upload,
  Wallet,
  Contact,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { exitSupport } from '@/app/actions/announcements';
import { AnnouncementBanners } from '@/components/app/announcement-banner';
import { DesignerCredit } from '@/components/app/credit';
import { AppShell } from '@/components/app/shell';
import { Sidebar, type NavGroup } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';
import { db } from '@/db';
import { complianceAlerts, notifications, subscriptions } from '@/db/schema';
import { bannersFor } from '@/lib/admin/announcements';
import { requireTenant } from '@/lib/auth/guards';
import { can } from '@/lib/auth/rbac';
import { f, getI18n } from '@/lib/i18n';
import { dayCount } from '@/lib/i18n/format';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await requireTenant();
  const { t, locale } = await getI18n();
  const [byModule, [unread], [subRow]] = await Promise.all([
    db
      .select({ module: complianceAlerts.module, n: count() })
      .from(complianceAlerts)
      .where(and(eq(complianceAlerts.tenantId, s.tenant.id), eq(complianceAlerts.status, 'open')))
      .groupBy(complianceAlerts.module),
    db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.tenantId, s.tenant.id), eq(notifications.userId, s.user.id), isNull(notifications.readAt))),
    db.select({ status: subscriptions.status, planId: subscriptions.planId }).from(subscriptions).where(eq(subscriptions.tenantId, s.tenant.id)),
  ]);
  const banners = await bannersFor({ id: s.tenant.id, status: subRow?.status ?? null, planId: subRow?.planId ?? null }, s.user.id);
  const m = Object.fromEntries(byModule.map((r) => [r.module, r.n])) as Record<string, number>;
  const totalOpen = byModule.reduce((sum, r) => sum + r.n, 0);
  const i = { size: 18, strokeWidth: 1.9 };

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/app', label: t.nav.overview, icon: <LayoutDashboard {...i} />, exact: true },
        { href: '/app/alerts', label: t.nav.alerts, icon: <BellRing {...i} />, count: totalOpen, countTone: 'alert' },
        { href: '/app/imports', label: t.nav.imports, icon: <Upload {...i} /> },
      ],
    },
    {
      label: t.nav.groupWorkforce,
      items: [
        { href: '/app/residents', label: t.nav.residents, icon: <IdCard {...i} />, count: m.residents },
        { href: '/app/gosi', label: t.nav.gosi, icon: <ShieldCheck {...i} />, count: m.gosi },
        { href: '/app/driver-cards', label: t.nav.driverCards, icon: <Contact {...i} />, count: m.driver_cards },
      ],
    },
    {
      label: t.nav.groupFleet,
      items: [
        { href: '/app/fleet', label: t.nav.fleet, icon: <Car {...i} />, count: m.fleet },
        { href: '/app/operating-cards', label: t.nav.operatingCards, icon: <CreditCard {...i} />, count: m.operating_cards },
      ],
    },
    {
      label: t.nav.groupCompliance,
      items: [
        { href: '/app/documents', label: t.nav.documents, icon: <FileText {...i} />, count: m.documents },
        { href: '/app/forecast', label: t.nav.forecast, icon: <Wallet {...i} /> },
        { href: '/app/notifications', label: t.nav.notifications, icon: <Bell {...i} />, count: unread.n },
      ],
    },
    {
      label: t.nav.groupAdmin,
      items: [
        ...(can(s.role, 'audit:read') ? [{ href: '/app/audit', label: t.nav.audit, icon: <ScrollText {...i} /> }] : []),
        { href: '/app/settings', label: t.nav.settings, icon: <Settings {...i} /> },
      ],
    },
  ];

  const sub = s.subscription;
  let banner: ReactNode = null;
  if (sub && !sub.canWrite) {
    banner = (
      <div className="banner banner--red" role="alert">
        <span>{t.banners.expired}</span>
        {can(s.role, 'billing:manage') ? (
          <Link href="/app/settings/billing" className="ui-btn ui-btn--sm ui-btn--outline">
            {t.banners.renew}
          </Link>
        ) : null}
      </div>
    );
  } else if (sub?.isTrial && sub.daysLeft !== null) {
    banner = (
      <div className="banner banner--amber">
        <span>{f(t.banners.trial, { days: dayCount(Math.max(sub.daysLeft, 0), locale) })}</span>
        {can(s.role, 'billing:manage') ? (
          <Link href="/app/settings/billing" className="ui-btn ui-btn--sm ui-btn--gold">
            {t.banners.trialCta}
          </Link>
        ) : null}
      </div>
    );
  } else if (sub?.status === 'past_due') {
    banner = <div className="banner banner--amber">{t.banners.pastDue}</div>;
  }

  const support = s.supportMode ? (
    <div className="banner banner--violet" role="status">
      <LifeBuoy size={18} className="flex-none" />
      <span className="banner__text">{f(t.console.tenants.supportBanner, { name: s.tenant.name })}</span>
      <form action={exitSupport}>
        <button type="submit" className="ui-btn ui-btn--sm" style={{ background: 'rgba(255,255,255,.22)', color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>
          {t.console.tenants.exitSupport}
        </button>
      </form>
    </div>
  ) : null;

  return (
    <AppShell sidebar={<Sidebar product={t.meta.product} tenantName={s.tenant.name} groups={groups} />}>
      <Topbar
        user={{ name: s.user.name, email: s.user.email }}
        tenantId={s.tenant.id}
        memberships={s.memberships}
        unread={unread.n}
        isSuperAdmin={s.user.isSuperAdmin}
      />
      {support}
      {banner}
      <AnnouncementBanners items={banners} />
      <main className="app-content">{children}</main>
      <DesignerCredit />
    </AppShell>
  );
}
