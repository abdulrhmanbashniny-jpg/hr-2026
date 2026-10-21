import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { cities, craftsmen, users, wallets } from '@/db/schema';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { requireStaffPage } from '@/lib/auth/guards';
import { digitsOnly } from '@/lib/digits';
import { fmtDate, fmtNumber, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function CraftsmenPage({ searchParams }: { searchParams: Promise<{ q?: string; tier?: string }> }) {
  await requireStaffPage('craftsmen:view');
  const { t, locale } = await getI18n();
  const c = consoleDictionary(locale);
  const { q, tier } = await searchParams;
  const where: SQL[] = [];
  const term = q?.trim().slice(0, 60);
  if (term) {
    const digits = digitsOnly(term);
    const conds = [ilike(craftsmen.displayName, `%${term}%`)];
    if (digits.length >= 3) conds.push(ilike(craftsmen.referralCode, `%${digits}%`), ilike(users.phone, `%${digits.replace(/^0/, '')}%`));
    where.push(or(...conds)!);
  }
  if (tier === 'A' || tier === 'B' || tier === 'C') where.push(eq(craftsmen.tier, tier));
  const rows = await db
    .select({ c: craftsmen, status: users.status, phone: users.phone, balance: wallets.balance, cityAr: cities.nameAr, cityEn: cities.nameEn })
    .from(craftsmen)
    .innerJoin(users, eq(users.id, craftsmen.userId))
    .innerJoin(cities, eq(cities.id, craftsmen.cityId))
    .leftJoin(wallets, eq(wallets.craftsmanId, craftsmen.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(craftsmen.createdAt))
    .limit(200);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold sm:text-3xl">{c.craftsmen.title}</h1>
      <form className="flex flex-wrap gap-2">
        <label className="glass flex h-11 min-w-64 flex-1 items-center gap-2 rounded-xl px-3">
          <Search className="size-4 text-muted" />
          <input name="q" defaultValue={term} placeholder={c.craftsmen.search} className="h-full flex-1 bg-transparent text-sm text-ink outline-none" />
        </label>
        <select name="tier" defaultValue={tier ?? ''} className="h-11 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">{c.craftsmen.tier}</option>
          {(['A', 'B', 'C'] as const).map((x) => (
            <option key={x} value={x}>
              {t.tiers[x]}
            </option>
          ))}
        </select>
        <button className="h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-ink">{t.common.search}</button>
      </form>
      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-xs text-muted">
            <tr>
              <th className="p-3 text-start font-medium">{c.invoices.craftsman}</th>
              <th className="p-3 text-start font-medium">{c.craftsmen.tier}</th>
              <th className="p-3 text-start font-medium">{c.craftsmen.city}</th>
              <th className="p-3 text-end font-medium">{c.craftsmen.balance}</th>
              <th className="p-3 text-start font-medium">{c.craftsmen.status}</th>
              <th className="p-3 text-start font-medium">{c.craftsmen.joined}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.c.id} className="hover:bg-surface-2/60">
                <td className="p-3">
                  <Link href={`/admin/craftsmen/${r.c.id}`} className="flex items-center gap-3">
                    <Avatar name={r.c.displayName} size={36} className="rounded-xl" />
                    <div>
                      <div className="font-medium text-ink hover:underline">{r.c.displayName}</div>
                      <div className="num text-xs text-muted">{r.c.referralCode}</div>
                    </div>
                  </Link>
                </td>
                <td className="p-3">
                  <Badge tone={r.c.tier === 'A' ? 'accent' : r.c.tier === 'B' ? 'navy' : 'neutral'}>{t.tiers.short[r.c.tier]}</Badge>
                </td>
                <td className="p-3 text-ink-2">{locale === 'ar' ? r.cityAr : r.cityEn}</td>
                <td className="num p-3 text-end text-ink">{fmtNumber(r.balance ?? 0)}</td>
                <td className="p-3">
                  <Badge tone={r.status === 'active' ? 'success' : 'danger'}>{r.status === 'active' ? c.craftsmen.active : c.craftsmen.suspended}</Badge>
                </td>
                <td className="p-3 text-muted">{fmtDate(r.c.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
