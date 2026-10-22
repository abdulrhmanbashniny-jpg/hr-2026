import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { cities, craftsmen, trades } from '@/db/schema';
import { CardStudio } from '@/components/app/card-studio';
import { PageHeader } from '@/components/ui/card';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { mediaUrl } from '@/lib/storage';
import { googleWalletConfigured } from '@/lib/wallet/google';

export default async function CardPage() {
  const s = await requireCraftsmanPage('/app/card');
  const { t, locale } = await getI18n();
  const [row] = await db.select({ c: craftsmen, city: cities }).from(craftsmen).innerJoin(cities, eq(cities.id, craftsmen.cityId)).where(eq(craftsmen.id, s.craftsman.id));
  const tradeRows = row.c.trades.length ? await db.select().from(trades).where(inArray(trades.id, row.c.trades)) : [];
  return (
    <div>
      <PageHeader title={t.card.title} subtitle={t.card.photoHint} />
      <CardStudio
        googleWallet={googleWalletConfigured()}
        data={{
          name: row.c.displayName,
          code: row.c.referralCode,
          tier: row.c.tier,
          city: locale === 'ar' ? row.city.nameAr : row.city.nameEn,
          memberSince: row.c.createdAt.toISOString(),
          verified: row.c.identityStatus === 'verified',
          photoUrl: mediaUrl(row.c.avatarKey),
          classification: tradeRows.slice(0, 2).map((x) => (locale === 'ar' ? x.nameAr : x.nameEn)).join('، ') || null,
        }}
      />
    </div>
  );
}
