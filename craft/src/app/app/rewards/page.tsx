import { RewardsStore } from '@/components/app/rewards-store';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { catalog, myRedemptions } from '@/lib/rewards/service';

export default async function RewardsPage() {
  const s = await requireCraftsmanPage('/app/rewards');
  const { t, locale } = await getI18n();
  const [c, mine] = await Promise.all([catalog(s.craftsman.id, s.craftsman.tier), myRedemptions(s.craftsman.id)]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t.rewards.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.rewards.subtitle}</p>
      </div>
      <RewardsStore
        balance={c.balance}
        next={c.next ? { rewardTitle: locale === 'ar' ? c.next.reward.titleAr : c.next.reward.titleEn, remaining: c.next.remaining, pct: c.next.pct } : null}
        items={c.items.map((r) => ({ id: r.id, kind: r.kind, titleAr: r.titleAr, titleEn: r.titleEn, partnerName: r.partnerName, pointsCost: r.pointsCost, valueSar: r.valueSar, stock: r.stock, minTier: r.minTier, affordable: r.affordable, tierAllowed: r.tierAllowed }))}
        redemptions={mine.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      />
    </div>
  );
}
