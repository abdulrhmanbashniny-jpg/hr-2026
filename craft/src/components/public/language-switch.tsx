'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/client';

export function LanguageSwitch({ className, compact }: { className?: string; compact?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await api('/me/locale', { body: { locale: locale === 'ar' ? 'en' : 'ar' } });
          router.refresh();
        })
      }
      className={cn('press inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50', className)}
      lang={locale === 'ar' ? 'en' : 'ar'}
    >
      <Languages className="size-4" />
      {!compact && t.common.language}
    </button>
  );
}
