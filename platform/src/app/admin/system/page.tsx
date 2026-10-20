import { SystemPanel } from '@/components/admin/catalog';
import { PlatformMailCard } from '@/components/admin/platform-mail';
import { PlatformTelegramCard } from '@/components/admin/platform-telegram';
import { Card, PageHead } from '@/components/ui/card';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { moyasarEnabled } from '@/lib/billing/moyasar';
import { env } from '@/lib/env';
import { getI18n } from '@/lib/i18n';
import { emailEnabled, platformMailSource } from '@/lib/notifications/email';
import { telegramEnabled } from '@/lib/notifications/telegram';
import { getPlatformSmtp, getPlatformTelegram } from '@/lib/platform-settings';

export default async function AdminSystem() {
  await requireSuperAdmin('system:manage');
  const { t } = await getI18n();
  const [smtp, source, email, tg] = await Promise.all([getPlatformSmtp(), platformMailSource(), emailEnabled(null), getPlatformTelegram()]);
  return (
    <>
      <PageHead title={t.console.system.title} sub={t.console.system.sub} />
      <div className="grid-2">
        <Card title={t.console.system.status}>
          <SystemPanel
            status={{
              telegram: telegramEnabled(),
              botUsername: env.telegram.botUsername,
              webhookSecret: !!env.telegram.webhookSecret,
              email,
              moyasar: moyasarEnabled(),
              storage: env.storage.driver,
              cron: !!env.cronSecret,
              appUrl: env.appUrl,
            }}
          />
        </Card>
        <PlatformMailCard
          vm={{
            source,
            saved: !!smtp,
            enabled: smtp?.enabled ?? false,
            host: smtp?.host ?? '',
            port: smtp?.port ?? 465,
            secure: smtp?.secure ?? true,
            user: smtp?.user ?? '',
            hasPassword: !!smtp?.passwordEnc,
            fromName: smtp?.fromName ?? '',
            fromEmail: smtp?.fromEmail ?? '',
          }}
        />
        <PlatformTelegramCard
          vm={{
            enabled: tg?.enabled ?? false,
            hasToken: !!tg?.botTokenEnc,
            username: tg?.botUsername || env.telegram.botUsername || null,
            chatIds: tg?.chatIds ?? [],
            platformBot: telegramEnabled(),
          }}
        />
      </div>
    </>
  );
}
