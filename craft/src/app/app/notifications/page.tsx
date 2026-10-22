import { NotificationList } from '@/components/app/notification-list';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export default async function NotificationsPage() {
  await requireCraftsmanPage('/app/notifications');
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.notifications.title}</h1>
      <NotificationList />
    </div>
  );
}
