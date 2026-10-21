import { and, eq, gt, isNull } from 'drizzle-orm';
import { StaffInviteForm } from '@/components/auth/staff-invite-form';
import { Notice } from '@/components/ui/card';
import { db } from '@/db';
import { staffInvites, users } from '@/db/schema';
import { isStaffRole } from '@/lib/admin/staff';
import { sha256 } from '@/lib/crypto';
import { f, getI18n } from '@/lib/i18n';

export const metadata = { robots: { index: false, follow: false } };

export default async function StaffInvitePage(props: PageProps<'/staff-invite/[token]'>) {
  const { t } = await getI18n();
  const c = t.console.team;
  const { token } = await props.params;
  const [invite] = await db
    .select()
    .from(staffInvites)
    .where(and(eq(staffInvites.tokenHash, sha256(token)), isNull(staffInvites.acceptedAt), isNull(staffInvites.revokedAt), gt(staffInvites.expiresAt, new Date())));
  if (!invite || !isStaffRole(invite.role)) return <Notice tone="red">{t.auth.inviteInvalid}</Notice>;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, invite.email));
  return (
    <div className="ui-card">
      <h1 className="text-2xl font-bold">{c.acceptTitle}</h1>
      <p className="mb-5 text-sm text-muted">{f(c.acceptSub, { role: c.roles[invite.role] })}</p>
      <StaffInviteForm token={token} email={invite.email} existing={!!existing} />
    </div>
  );
}
