'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n/client';

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api<{ items: NotificationRow[]; unread: number }>('/notifications'), refetchInterval: 60_000 });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return async (ids?: string[]) => {
    await api('/notifications/read', { body: { ids } });
    await qc.invalidateQueries({ queryKey: ['notifications'] });
  };
}

export function NotificationBell() {
  const { t } = useI18n();
  const { data } = useNotifications();
  return (
    <Link href="/app/notifications" aria-label={t.nav.notifications} className="press relative grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-surface-2">
      <Bell className="size-5" />
      {!!data?.unread && <span className="num absolute top-1 end-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
    </Link>
  );
}
