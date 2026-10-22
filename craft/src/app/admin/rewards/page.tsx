import { asc, desc, eq } from 'drizzle-orm';
import { Gift } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { craftsmen, redemptions, rewards } from '@/db/schema';
import { FulfillRow, NewReward, RewardEditor } from '@/components/admin/rewards-admin';
import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { staffCan } from '@/lib/auth/roles';
import { formatLocal } from '@/lib/phone';
import { fmtNumber, fmtRelative, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function RewardsAdminPage() {
  const s = await requireStaffPage('redemptions:fulfill');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const [queue, catalog] = await Promise.all([
    db
      .select({ r: redemptions, reward: rewards, name: craftsmen.displayName, code: craftsmen.referralCode, craftsmanId: craftsmen.id })
      .from(redemptions)
      .innerJoin(rewards, eq(rewards.id, redemptions.rewardId))
      .innerJoin(craftsmen, eq(craftsmen.id, redemptions.craftsmanId))
      .where(eq(redemptions.status, 'requested'))
      .orderBy(asc(redemptions.createdAt)),
    db.select().from(rewards).orderBy(asc(rewards.sortOrder), desc(rewards.createdAt)),
  ]);
  const canEdit = staffCan(s.user.role, 'rewards:manage');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{c.rewards.title}</h1>
      <Card>
        <CardHeader title={c.rewards.queue} />
        {queue.length === 0 ? (
          <EmptyState icon={<Gift className="size-6" />} title={c.rewards.empty} />
        ) : (
          <ul className="divide-y divide-line">
            {queue.map((q) => (
              <li key={q.r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{locale === 'ar' ? q.reward.titleAr : q.reward.titleEn}</div>
                  <div className="text-xs text-muted">
                    <Link href={`/admin/craftsmen/${q.craftsmanId}`} className="hover:underline">
                      {q.name}
                    </Link>{' '}
                    · <span className="num">{fmtNumber(q.r.pointsSpent)}</span> · {fmtRelative(q.r.createdAt, locale)}
                    {q.r.payoutHandle && (
                      <>
                        {' '}
                        · {c.rewards.payout}{' '}
                        <span className="num" dir="ltr">
                          {formatLocal(q.r.payoutHandle)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <FulfillRow id={q.r.id} needsCode={q.reward.kind === 'fuel_voucher' || q.reward.kind === 'supplier_discount'} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canEdit && (
        <Card>
          <CardHeader title={c.rewards.catalog} action={<NewReward />} />
          <div className="space-y-6">
            {catalog.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line p-4">
                <RewardEditor reward={{ id: r.id, kind: r.kind, titleAr: r.titleAr, titleEn: r.titleEn, partnerName: r.partnerName, pointsCost: r.pointsCost, valueSar: r.valueSar, stock: r.stock, minTier: r.minTier, isActive: r.isActive }} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
