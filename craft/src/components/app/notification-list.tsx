'use client';

import { BellOff, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { fmtRelative } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { useMarkRead, useNotifications } from './notification-bell';

export function NotificationList() {
  const { t, locale } = useI18n();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkRead();
  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  if (!data?.items.length) return <EmptyState icon={<BellOff className="size-6" />} title={t.notifications.empty} />;
  return (
    <div className="space-y-4">
      {data.unread > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon={<CheckCheck className="size-4" />} onClick={() => markRead()}>
            {t.notifications.markAll}
          </Button>
        </div>
      )}
      <ul className="surface divide-y divide-line p-0">
        {data.items.map((n) => {
          const body = (
            <div className="flex gap-3 p-4">
              <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')} />
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm', n.readAt ? 'text-ink-2' : 'font-semibold text-ink')}>{n.title}</div>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <div className="mt-1 text-xs text-faint">{fmtRelative(n.createdAt, locale)}</div>
              </div>
            </div>
          );
          return (
            <li key={n.id} onClick={() => !n.readAt && markRead([n.id])}>
              {n.url ? (
                <Link href={n.url} className="block hover:bg-surface-2">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
