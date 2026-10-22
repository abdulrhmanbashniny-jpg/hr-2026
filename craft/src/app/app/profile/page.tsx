import { eq } from 'drizzle-orm';
import { ExternalLink, KeyRound } from 'lucide-react';
import { db } from '@/db';
import { craftsmen } from '@/db/schema';
import { ProfileForm } from '@/components/app/profile-form';
import { ButtonLink } from '@/components/ui/button';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { catalogue } from '@/lib/catalogue';
import { getI18n } from '@/lib/i18n';

export default async function ProfilePage() {
  const s = await requireCraftsmanPage('/app/profile');
  const { t } = await getI18n();
  const [[c], { cities, trades }] = await Promise.all([db.select().from(craftsmen).where(eq(craftsmen.id, s.craftsman.id)), catalogue()]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.profileEdit.title}</h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/account/password?next=/app/profile" variant="secondary" icon={<KeyRound className="size-4" />}>
            {t.auth.changeTitle}
          </ButtonLink>
          <ButtonLink href={`/c/${c.referralCode}`} variant="secondary" icon={<ExternalLink className="size-4" />}>
            {t.profile.verifiedBy}
          </ButtonLink>
        </div>
      </div>
      <ProfileForm
        catalogue={{ cities, trades }}
        data={{
          displayName: c.displayName,
          bio: c.bio,
          cityId: c.cityId,
          trades: c.trades,
          yearsExperience: c.yearsExperience,
          whatsapp: c.whatsapp,
          acceptsCalls: c.acceptsCalls,
          warrantyMonths: c.warrantyMonths,
          identityStatus: c.identityStatus,
          nationalIdLast4: c.nationalIdLast4,
          licenseStatus: c.licenseStatus,
          licenseNumber: c.licenseNumber,
          deletionRequestedAt: c.deletionRequestedAt?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
