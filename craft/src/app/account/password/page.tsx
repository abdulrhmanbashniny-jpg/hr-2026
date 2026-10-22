import { eq } from 'drizzle-orm';
import { KeyRound } from 'lucide-react';
import type { Metadata } from 'next';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AuthShell } from '@/components/auth/auth-shell';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { requireUserPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.changeTitle, robots: { index: false } };
}

/** Choosing a new password; the only page a user holding a temporary password can reach. */
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await requireUserPage('/account/password');
  const { t } = await getI18n();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, s.user.id));
  const forced = s.user.mustChangePassword;
  return (
    <AuthShell
      aside={
        <div className="grid size-40 place-items-center rounded-full bg-white/10 text-secondary-container">
          <KeyRound className="size-20" />
        </div>
      }
    >
      <h1 className="text-3xl font-bold">{t.auth.changeTitle}</h1>
      <p className="mt-2 mb-8 text-muted">{forced ? t.auth.changeForced : t.auth.changeSubtitle}</p>
      <ChangePasswordForm next={(await searchParams).next} hasPassword={!!row?.hash} forced={forced} />
    </AuthShell>
  );
}
