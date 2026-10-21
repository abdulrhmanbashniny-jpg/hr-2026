import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { craftsmen, invoices, leads, notifications, pointsLedger, portfolioProjects, redemptions, referrals, users } from '@/db/schema';
import { apiUser } from '@/lib/auth/guards';
import { route } from '@/lib/http';

/** PDPL right of access: everything we hold about the signed-in person, as one JSON file. */
export const GET = route(async () => {
  const s = await apiUser();
  const [user] = await db.select({ id: users.id, phone: users.phone, name: users.name, locale: users.locale, createdAt: users.createdAt }).from(users).where(eq(users.id, s.user.id));
  const c = s.craftsman;
  const [profile] = c ? await db.select().from(craftsmen).where(eq(craftsmen.id, c.id)) : [];
  const data = {
    exportedAt: new Date().toISOString(),
    user,
    craftsman: profile ? { ...profile, nationalIdEnc: undefined, nationalIdLast4: profile.nationalIdLast4 } : null,
    portfolio: c ? await db.select().from(portfolioProjects).where(eq(portfolioProjects.craftsmanId, c.id)) : [],
    invoices: c
      ? await db
          .select({ id: invoices.id, status: invoices.status, sellerName: invoices.sellerName, totalAmount: invoices.totalAmount, issuedAt: invoices.issuedAt, pointsAwarded: invoices.pointsAwarded, createdAt: invoices.createdAt })
          .from(invoices)
          .where(eq(invoices.craftsmanId, c.id))
      : [],
    ledger: c ? await db.select().from(pointsLedger).where(eq(pointsLedger.craftsmanId, c.id)).orderBy(desc(pointsLedger.createdAt)) : [],
    redemptions: c ? await db.select({ id: redemptions.id, status: redemptions.status, pointsSpent: redemptions.pointsSpent, createdAt: redemptions.createdAt }).from(redemptions).where(eq(redemptions.craftsmanId, c.id)) : [],
    referralsMade: c ? await db.select({ id: referrals.id, status: referrals.status, createdAt: referrals.createdAt }).from(referrals).where(eq(referrals.referrerId, c.id)) : [],
    leads: c ? await db.select({ channel: leads.channel, source: leads.source, createdAt: leads.createdAt }).from(leads).where(eq(leads.craftsmanId, c.id)) : [],
    notifications: await db.select().from(notifications).where(eq(notifications.userId, s.user.id)),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="hirfa-my-data.json"', 'cache-control': 'private, no-store' },
  });
});
