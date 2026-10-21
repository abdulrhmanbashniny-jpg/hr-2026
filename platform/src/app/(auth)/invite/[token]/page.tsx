import { and, eq, gt, isNull } from 'drizzle-orm';
import { InviteForm } from '@/components/auth/forms';
import { Notice } from '@/components/ui/card';
import { db } from '@/db';
import { invitations, tenants, users } from '@/db/schema';
import { getSession } from '@/lib/auth/session';
import { sha256 } from '@/lib/crypto';
import { f, getI18n } from '@/lib/i18n';

export default async function InvitePage(props: PageProps<'/invite/[token]'>) {
  const { t } = await getI18n();
  const { token } = await props.params;
  const [inv] = await db
    .select({ inv: invitations, company: tenants.name })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .where(and(eq(invitations.tokenHash, sha256(token)), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())));
  if (!inv) return <Notice tone="red">{t.auth.inviteInvalid}</Notice>;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, inv.inv.email));
  const s = await getSession();
  const signedIn = s ? { email: s.user.email, matches: !!existing && s.user.id === existing.id } : null;
  return (
    <div className="ui-card">
      <h1 className="text-2xl font-bold">{f(t.auth.inviteTitle, { company: inv.company })}</h1>
      <p className="mb-5 text-sm text-muted">{f(t.auth.inviteSubtitle, { company: inv.company, role: t.roles[inv.inv.role] })}</p>
      <InviteForm token={token} existing={!!existing} email={inv.inv.email} signedIn={signedIn} />
    </div>
  );
}
