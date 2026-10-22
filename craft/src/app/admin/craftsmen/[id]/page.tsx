import { countDistinct, desc, eq, inArray } from 'drizzle-orm';
import { BadgeCheck, Ban, ExternalLink, FileText, KeyRound, Network, ShieldCheck, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/db';
import { cities, craftsmen, deviceSignals, invoices, pointsLedger, portfolioProjects, referrals, users, verificationDocuments, wallets } from '@/db/schema';
import { reviewDocumentAction, setSuspendedAction, verifyProjectAction } from '@/app/admin/actions';
import { ActionButton } from '@/components/admin/action-button';
import { AccessAdmin, AdjustForm, PhotoAdmin, TierForm } from '@/components/admin/craftsman-controls';
import { LedgerList } from '@/components/app/ledger-list';
import { Avatar } from '@/components/ui/avatar';
import { Badge, type Tone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { env } from '@/lib/env';
import { staffCan } from '@/lib/auth/roles';
import { formatLocal } from '@/lib/phone';
import { mediaUrl } from '@/lib/storage';
import { f, fmtDate, fmtMoney, fmtNumber, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';
import { getBrand } from '@/lib/products/service';

const STATUS_TONE: Record<string, Tone> = { unverified: 'neutral', pending: 'info', verified: 'success', rejected: 'danger', approved: 'success', flagged: 'warning', processing: 'info', activated: 'success', held: 'warning' };

export default async function CraftsmanDetail({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaffPage('craftsmen:view');
  const { t, locale } = await getI18n();
  const c = consoleDictionary(locale);
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db
    .select({ c: craftsmen, user: users, city: cities, wallet: wallets })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .innerJoin(cities, eq(cities.id, craftsmen.cityId))
    .leftJoin(wallets, eq(wallets.craftsmanId, craftsmen.id))
    .where(eq(craftsmen.id, id));
  if (!row) notFound();
  const canManage = staffCan(s.user.role, 'craftsmen:manage');
  const [docs, projects, invs, ledger, refs, devices] = await Promise.all([
    db.select().from(verificationDocuments).where(eq(verificationDocuments.craftsmanId, id)).orderBy(desc(verificationDocuments.createdAt)),
    db.select().from(portfolioProjects).where(eq(portfolioProjects.craftsmanId, id)).orderBy(desc(portfolioProjects.createdAt)),
    db.select().from(invoices).where(eq(invoices.craftsmanId, id)).orderBy(desc(invoices.createdAt)).limit(12),
    db.select().from(pointsLedger).where(eq(pointsLedger.craftsmanId, id)).orderBy(desc(pointsLedger.createdAt)).limit(12),
    db.select({ status: referrals.status, name: craftsmen.displayName, id: craftsmen.id }).from(referrals).innerJoin(craftsmen, eq(craftsmen.id, referrals.refereeId)).where(eq(referrals.referrerId, id)),
    db
      .select({ deviceId: deviceSignals.deviceId, others: countDistinct(deviceSignals.userId) })
      .from(deviceSignals)
      .where(inArray(deviceSignals.deviceId, db.select({ d: deviceSignals.deviceId }).from(deviceSignals).where(eq(deviceSignals.userId, row.user.id))))
      .groupBy(deviceSignals.deviceId),
  ]);
  const shared = Math.max(0, ...devices.map((d) => d.others - 1));
  const brand = await getBrand();
  const suspended = row.user.status === 'suspended';

  return (
    <div className="space-y-6">
      <div className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <PhotoAdmin craftsmanId={id} name={row.c.displayName} photoUrl={mediaUrl(row.c.avatarKey)} canManage={canManage} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-headline-lg text-primary">{row.c.displayName}</h1>
            <Badge tone={row.c.tier === 'A' ? 'accent' : row.c.tier === 'B' ? 'navy' : 'neutral'}>{t.tiers[row.c.tier]}</Badge>
            {suspended && <Badge tone="danger">{c.craftsmen.suspended}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="num">{row.c.referralCode}</span>
            <span className="num" dir="ltr">
              {formatLocal(row.user.phone)}
            </span>
            <span>{locale === 'ar' ? row.city.nameAr : row.city.nameEn}</span>
            <span>
              {c.craftsmen.joined}: {fmtDate(row.c.createdAt, locale)}
            </span>
          </div>
          {row.c.deletionRequestedAt && <p className="mt-2 text-sm text-warning">{f(c.craftsmen.deletion, { date: fmtDate(row.c.deletionRequestedAt, locale) })}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/c/${row.c.referralCode}`} variant="secondary" size="sm" icon={<ExternalLink className="size-4" />}>
            {c.craftsmen.profile}
          </ButtonLink>
          {canManage && (
            <ActionButton action={setSuspendedAction.bind(null, id, !suspended)} variant={suspended ? 'primary' : 'danger'} confirm={suspended ? undefined : c.craftsmen.suspendConfirm} icon={<Ban className="size-4" />}>
              {suspended ? c.craftsmen.reactivate : c.craftsmen.suspend}
            </ActionButton>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={c.craftsmen.documents} icon={<FileText className="size-5" />} />
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <Badge tone={STATUS_TONE[row.c.identityStatus]} icon={<ShieldCheck className="size-3.5" />}>
                {c.verification.kinds.national_id}: {t.profileEdit.statuses[row.c.identityStatus]}
                {row.c.nationalIdLast4 ? ` · ••${row.c.nationalIdLast4}` : ''}
              </Badge>
              <Badge tone={STATUS_TONE[row.c.licenseStatus]} icon={<BadgeCheck className="size-3.5" />}>
                {c.verification.kinds.freelance_license}: {t.profileEdit.statuses[row.c.licenseStatus]}
              </Badge>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-muted">{c.craftsmen.noDocuments}</p>
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                    <a href={`/api/v1/admin/documents/${d.id}`} target="_blank" rel="noopener" className="flex-1 text-sm font-medium text-ink hover:underline">
                      {c.verification.kinds[d.kind]}
                    </a>
                    <span className="text-xs text-muted">{fmtDate(d.createdAt, locale)}</span>
                    <Badge tone={STATUS_TONE[d.status]}>{t.profileEdit.statuses[d.status]}</Badge>
                    {canManage && d.status === 'pending' && (
                      <>
                        <ActionButton action={reviewDocumentAction.bind(null, d.id, true, undefined)} variant="accent">
                          {c.verification.approve}
                        </ActionButton>
                        <ActionButton action={reviewDocumentAction.bind(null, d.id, false, undefined)} variant="danger">
                          {c.verification.reject}
                        </ActionButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={c.craftsmen.projects} />
            <ul className="divide-y divide-line">
              {projects.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex-1 text-sm text-ink">{p.title}</span>
                  {p.verification === 'field_verified' && <Badge tone="success">{t.portfolio.verifiedBadge}</Badge>}
                  {canManage && (
                    <ActionButton action={verifyProjectAction.bind(null, p.id, p.verification !== 'field_verified')} variant={p.verification === 'field_verified' ? 'ghost' : 'secondary'}>
                      {p.verification === 'field_verified' ? c.craftsmen.unverifyProject : c.craftsmen.verifyProject}
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={c.craftsmen.invoices} />
            <ul className="divide-y divide-line text-sm">
              {invs.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="flex-1 truncate text-ink-2">{i.sellerName ?? '—'}</span>
                  <span className="tabular text-ink">{fmtMoney(i.totalAmount, locale, 2)}</span>
                  <Badge tone={STATUS_TONE[i.status]}>{t.invoices.statuses[i.status]}</Badge>
                  <span className="num w-10 text-end text-xs text-muted">{i.riskScore}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="text-sm text-muted">{c.craftsmen.balance}</div>
            <div className="num text-3xl font-semibold text-ink">{fmtNumber(row.wallet?.balance ?? 0)}</div>
            <div className="text-xs text-muted">
              {t.home.lifetime}: <span className="num">{fmtNumber(row.wallet?.lifetimeEarned ?? 0)}</span>
            </div>
          </Card>
          <Card>
            <CardHeader title={c.craftsmen.access} icon={<KeyRound className="size-5" />} />
            <AccessAdmin
              userId={row.user.id}
              phone={row.user.phone}
              phoneVerified={!!row.user.phoneVerifiedAt}
              canManage={canManage}
              brand={locale === 'ar' ? brand.factoryNameAr : brand.factoryNameEn}
              appUrl={env.appUrl}
            />
          </Card>
          {canManage && (
            <Card>
              <CardHeader title={c.craftsmen.setTier} />
              <TierForm craftsmanId={id} tier={row.c.tier} />
            </Card>
          )}
          {staffCan(s.user.role, 'points:adjust') && (
            <Card>
              <CardHeader title={c.craftsmen.adjust} />
              <AdjustForm craftsmanId={id} />
            </Card>
          )}
          <Card>
            <CardHeader title={c.craftsmen.signals} icon={<Smartphone className="size-5" />} />
            <p className={`text-sm ${shared > 0 ? 'text-danger' : 'text-muted'}`}>{shared > 0 ? f(c.craftsmen.sharedWith, { n: shared }) : '—'}</p>
          </Card>
          <Card>
            <CardHeader title={c.craftsmen.referrals} icon={<Network className="size-5" />} />
            <ul className="space-y-2 text-sm">
              {refs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/craftsmen/${r.id}`} className="truncate text-ink-2 hover:underline">
                    {r.name}
                  </Link>
                  <Badge tone={STATUS_TONE[r.status]}>{t.referrals.statuses[r.status]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title={c.craftsmen.ledger} />
            <LedgerList rows={ledger} t={t} locale={locale} />
          </Card>
        </div>
      </div>
    </div>
  );
}
