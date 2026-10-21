import { WifiOff } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { getI18n } from '@/lib/i18n';

export const dynamic = 'force-static';

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-surface-2 text-muted">
        <WifiOff className="size-8" />
      </div>
      <p className="max-w-sm text-ink-2">{t.common.offline}</p>
      <ButtonLink href="/app/card" variant="primary">
        {t.nav.card}
      </ButtonLink>
    </main>
  );
}
