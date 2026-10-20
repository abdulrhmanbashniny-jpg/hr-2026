import { and, eq, gt, isNull } from 'drizzle-orm';
import Link from 'next/link';
import { ChannelsForms, CompanyForm, ContactsPanel, MembersPanel, RulesForm } from '@/components/settings/forms';
import { Card, Notice, PageHead } from '@/components/ui/card';
import { db } from '@/db';
import { contacts, invitations, memberships, users } from '@/db/schema';
import { requireTenant } from '@/lib/auth/guards';
import { can, permissionsOf, ROLES } from '@/lib/auth/rbac';
import { env } from '@/lib/env';
import { getI18n } from '@/lib/i18n';
import { botFor, platformBot, telegramDeepLink, tenantBot } from '@/lib/notifications/telegram';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.settings.title };
}

const TABS = ['general', 'members', 'contacts', 'channels', 'rules'] as const;

export default async function SettingsPage(props: PageProps<'/app/settings'>) {
  const s = await requireTenant();
  const { t } = await getI18n();
  const sp = await props.searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as (typeof TABS)[number]) : 'general';
  const manage = can(s.role, 'settings:manage');

  const bot = botFor(s.settings, s.tenant.id);
  let body: React.ReactNode = null;
  if (tab === 'general') {
    body = <CompanyForm name={s.tenant.name} crNumber={s.tenant.crNumber} canEdit={manage} />;
  } else if (tab === 'members') {
    const [members, invites] = await Promise.all([
      db
        .select({ id: memberships.id, role: memberships.role, userId: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.tenantId, s.tenant.id)),
      db.select().from(invitations).where(and(eq(invitations.tenantId, s.tenant.id), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()))),
    ]);
    body = (
      <MembersPanel
        members={members.map((m) => ({ ...m, lastLoginAt: m.lastLoginAt?.toISOString() ?? null }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString() }))}
        currentUserId={s.user.id}
        currentRole={s.role}
        canManage={can(s.role, 'members:manage')}
        matrix={ROLES.map((r) => ({ role: r, permissions: permissionsOf(r) }))}
      />
    );
  } else if (tab === 'contacts') {
    const rows = await db.select().from(contacts).where(eq(contacts.tenantId, s.tenant.id)).orderBy(contacts.createdAt);
    body = (
      <ContactsPanel
        contacts={rows.map((c) => ({
          id: c.id,
          name: c.name,
          jobTitle: c.jobTitle,
          phone: c.phone,
          email: c.email,
          modules: c.modules,
          canRequestDocuments: c.canRequestDocuments,
          receiveWeeklyReport: c.receiveWeeklyReport,
          telegramUsername: c.telegramUsername,
          telegramLinked: !!c.telegramChatId,
          telegramChatId: c.telegramChatId,
          telegramLink: c.telegramLinkCode ? telegramDeepLink(bot, c.telegramLinkCode) : null,
        }))}
        canManage={can(s.role, 'contacts:manage')}
        botConfigured={!!bot?.username}
      />
    );
  } else if (tab === 'channels') {
    body = (
      <ChannelsForms
        smtp={{ ...s.settings.smtp, hasPassword: !!s.settings.smtp.passwordEnc, passwordEnc: null }}
        whatsapp={{ ...s.settings.whatsapp, hasToken: !!s.settings.whatsapp.cloudTokenEnc, hasAuth: !!s.settings.whatsapp.webhookAuthHeaderEnc, cloudTokenEnc: null, webhookAuthHeaderEnc: null }}
        telegram={{
          own: !!tenantBot(s.settings, s.tenant.id),
          username: bot?.username ?? null,
          platformUsername: platformBot()?.username ?? null,
          botName: s.settings.telegram.botName,
          groupChatId: s.settings.telegram.groupChatId,
          allowSummary: s.settings.telegram.allowSummary,
          allowAlerts: s.settings.telegram.allowAlerts,
          allowDocuments: s.settings.telegram.allowDocuments,
          allowActions: s.settings.telegram.allowActions,
        }}
        canEdit={manage}
      />
    );
  } else {
    body = <RulesForm settings={{ ...s.settings, smtp: { ...s.settings.smtp, passwordEnc: null }, whatsapp: { ...s.settings.whatsapp, cloudTokenEnc: null, webhookAuthHeaderEnc: null }, telegram: { ...s.settings.telegram, botTokenEnc: null, webhookSecret: '' } }} canEdit={manage} />;
  }

  return (
    <>
      <PageHead title={t.settings.title} />
      <div className="ui-tabs" role="tablist">
        {TABS.map((k) => (
          <Link key={k} href={`/app/settings?tab=${k}`} role="tab" aria-selected={tab === k} className="ui-tab">
            {t.settings.tabs[k]}
          </Link>
        ))}
        <Link href="/app/settings/billing" role="tab" aria-selected={false} className="ui-tab">
          {t.settings.tabs.billing}
        </Link>
      </div>
      {!manage && (tab === 'general' || tab === 'channels' || tab === 'rules') ? <Notice tone="blue">{t.common.forbidden}</Notice> : null}
      <Card>{body}</Card>
    </>
  );
}
