import { eq } from 'drizzle-orm';
import { ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { craftsmen, users } from '@/db/schema';
import { AccessAdmin, DeleteAccount } from '@/components/admin/craftsman-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { isStaff, staffCan } from '@/lib/auth/roles';
import { env } from '@/lib/env';
import { fmtDate, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';
import { formatLocal, normalizeSaudiMobile } from '@/lib/phone';
import { getBrand } from '@/lib/products/service';

/** Any account by its number, including sign-ups without a card and staff: recovery and squatted numbers. */
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const s = await requireStaffPage('craftsmen:view');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const raw = (await searchParams).phone?.slice(0, 20) ?? '';
  const phone = raw ? normalizeSaudiMobile(raw) : null;
  const [row] = phone
    ? await db.select({ user: users, craftsmanId: craftsmen.id, name: craftsmen.displayName }).from(users).leftJoin(craftsmen, eq(craftsmen.userId, users.id)).where(eq(users.phone, phone))
    : [];
  const brand = await getBrand();
  const self = row?.user.id === s.user.id;
  const canManage = !!row && !self && (isStaff(row.user.role) ? staffCan(s.user.role, 'settings:manage') : staffCan(s.user.role, 'craftsmen:manage'));

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.accounts.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.accounts.subtitle}</p>
      </div>
      <form className="flex flex-wrap gap-2">
        <label className="glass flex h-11 min-w-64 flex-1 items-center gap-2 rounded-xl px-3" dir="ltr">
          <Search className="size-4 text-muted" />
          <input name="phone" defaultValue={raw} inputMode="tel" placeholder="05XXXXXXXX" aria-label={c.accounts.phone} className="num h-full flex-1 bg-transparent text-sm text-ink outline-none" />
        </label>
        <button className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-ink">{c.accounts.phone}</button>
      </form>

      {raw && !row && <p className="rounded-xl bg-surface-2 p-3.5 text-sm text-muted">{c.accounts.notFound}</p>}

      {row && (
        <Card>
          <CardHeader title={row.name ?? formatLocal(row.user.phone)} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-muted">{c.accounts.phone}</dt>
              <dd className="num" dir="ltr">
                {formatLocal(row.user.phone)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{c.accounts.role}</dt>
              <dd>
                <Badge tone={isStaff(row.user.role) ? 'navy' : 'neutral'}>{c.roles[row.user.role]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted">{c.accounts.created}</dt>
              <dd>{fmtDate(row.user.createdAt, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted">{c.accounts.lastLogin}</dt>
              <dd>{row.user.lastLoginAt ? fmtDate(row.user.lastLoginAt, locale) : c.accounts.never}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted">{c.accounts.card}</dt>
              <dd>
                {row.craftsmanId ? (
                  <Link href={`/admin/craftsmen/${row.craftsmanId}`} className="inline-flex items-center gap-1 font-medium text-primary-container hover:underline">
                    <ExternalLink className="size-4" />
                    {c.accounts.openCard}
                  </Link>
                ) : (
                  c.accounts.noCard
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-line pt-4">
            <AccessAdmin
              userId={row.user.id}
              phone={row.user.phone}
              phoneVerified={!!row.user.phoneVerifiedAt}
              canManage={canManage}
              brand={locale === 'ar' ? brand.factoryNameAr : brand.factoryNameEn}
              appUrl={env.appUrl}
            />
          </div>
          {canManage && !row.craftsmanId && !isStaff(row.user.role) && (
            <div className="mt-5 border-t border-line pt-4">
              <DeleteAccount userId={row.user.id} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
