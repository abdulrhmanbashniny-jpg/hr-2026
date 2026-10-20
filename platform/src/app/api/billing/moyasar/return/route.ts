import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { activatePayment, failPayment } from '@/lib/billing/activate';
import { fetchInvoice } from '@/lib/billing/moyasar';
import { getSession } from '@/lib/auth/session';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Customer returns from the Moyasar checkout. The invoice status is verified server-to-server. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('payment') ?? '';
  const back = new URL('/app/settings/billing', env.appUrl);
  if (!/^[0-9a-f-]{36}$/.test(paymentId)) return NextResponse.redirect(back);
  const s = await getSession();
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || !p.providerRef || (s?.tenant && s.tenant.id !== p.tenantId)) return NextResponse.redirect(back);
  const invoice = await fetchInvoice(p.providerRef);
  if (invoice.status === 'paid' && invoice.amount === p.total) {
    await activatePayment(p.id, s?.user.id ?? null);
    back.searchParams.set('paid', '1');
  } else if (['failed', 'canceled', 'expired', 'voided'].includes(invoice.status)) {
    await failPayment(p.id);
    back.searchParams.set('failed', '1');
  }
  return NextResponse.redirect(back);
}
