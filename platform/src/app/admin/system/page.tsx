import { SystemPanel } from '@/components/admin/catalog';
import { Card, PageHead } from '@/components/ui/card';
import { env } from '@/lib/env';
import { getI18n } from '@/lib/i18n';
import { moyasarEnabled } from '@/lib/billing/moyasar';
import { emailEnabled } from '@/lib/notifications/email';
import { telegramEnabled } from '@/lib/notifications/telegram';

export default async function AdminSystem() {
  const { t } = await getI18n();
  return (
    <>
      <PageHead title={t.console.system.title} sub={t.console.system.sub} />
      <Card>
        <SystemPanel
          status={{
            telegram: telegramEnabled(),
            botUsername: env.telegram.botUsername,
            webhookSecret: !!env.telegram.webhookSecret,
            email: emailEnabled(null),
            moyasar: moyasarEnabled(),
            storage: env.storage.driver,
            cron: !!env.cronSecret,
            appUrl: env.appUrl,
          }}
        />
      </Card>
    </>
  );
}
