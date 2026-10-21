import { and, desc, eq, lt } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { pointsLedger, wallets } from '@/db/schema';
import { apiCraftsman } from '@/lib/auth/guards';
import { NO_STORE, ok, readQuery, route } from '@/lib/http';
import { getEconomics } from '@/lib/settings/store';

export const GET = route(async (req: NextRequest) => {
  const s = await apiCraftsman();
  const { cursor } = readQuery(req, z.object({ cursor: z.iso.datetime({ offset: true }).optional() }));
  const [[w], eco, rows] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.craftsmanId, s.craftsman.id)),
    getEconomics(),
    db
      .select()
      .from(pointsLedger)
      .where(and(eq(pointsLedger.craftsmanId, s.craftsman.id), cursor ? lt(pointsLedger.createdAt, new Date(cursor)) : undefined))
      .orderBy(desc(pointsLedger.createdAt))
      .limit(31),
  ]);
  return ok(
    {
      balance: w?.balance ?? 0,
      lifetimeEarned: w?.lifetimeEarned ?? 0,
      lifetimeRedeemed: w?.lifetimeRedeemed ?? 0,
      valueSar: Math.round((w?.balance ?? 0) * eco.pointValueSar * 100) / 100,
      ledger: { items: rows.slice(0, 30), nextCursor: rows.length > 30 ? rows[29].createdAt.toISOString() : null },
    },
    { headers: NO_STORE },
  );
});
