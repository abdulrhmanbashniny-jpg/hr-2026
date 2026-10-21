import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cities, craftsmen } from '@/db/schema';
import { CardStudio } from '@/components/app/card-studio';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import { googleWalletConfigured } from '@/lib/wallet/google';

export default async function CardPage() {
  const s = await requireCraftsmanPage('/app/card');
  const { t, locale } = await getI18n();
  const [row] = await db.select({ c: craftsmen, city: cities }).from(craftsmen).innerJoin(cities, eq(cities.id, craftsmen.cityId)).where(eq(craftsmen.id, s.craftsman.id));
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.card.title}</h1>
      <CardStudio
        googleWallet={googleWalletConfigured()}
        data={{
          name: row.c.displayName,
          code: row.c.referralCode,
          tier: row.c.tier,
          city: locale === 'ar' ? row.city.nameAr : row.city.nameEn,
          memberSince: row.c.createdAt.toISOString(),
          verified: row.c.identityStatus === 'verified',
        }}
      />
    </div>
  );
}
