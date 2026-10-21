import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { cities } from '@/db/schema';
import { apiCraftsman } from '@/lib/auth/guards';
import { env } from '@/lib/env';
import { ApiError, NO_STORE, ok, route } from '@/lib/http';
import { dictionary, getLocale } from '@/lib/i18n';
import { googleWalletConfigured, googleWalletSaveUrl } from '@/lib/wallet/google';

export const GET = route(async () => {
  const s = await apiCraftsman();
  if (!googleWalletConfigured()) throw new ApiError('not_configured');
  const t = dictionary(await getLocale());
  const [city] = await db.select().from(cities).where(eq(cities.id, s.craftsman.cityId));
  const saveUrl = await googleWalletSaveUrl({
    code: s.craftsman.referralCode,
    displayName: s.craftsman.displayName,
    tierLabel: t.tiers[s.craftsman.tier],
    city: city?.nameAr ?? '',
    profileUrl: `${env.appUrl}/c/${s.craftsman.referralCode}`,
  });
  return ok({ saveUrl }, { headers: NO_STORE });
});
