import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { payments } from '@/db/schema';
import { activatePayment, failPayment } from '@/lib/billing/activate';
import { fetchInvoice } from '@/lib/billing/moyasar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Moyasar callback. The body is never trusted: we take only the invoice id from it and fetch the
 * invoice with our secret key before activating anything.
 */
export async function POST(req: Request) {
  let invoiceId = '';
  try {
    const body = (await req.json()) as { id?: string; invoice_id?: string; data?: { id?: string; invoice_id?: string } };
    invoiceId = body.invoice_id ?? body.data?.invoice_id ?? body.id ?? body.data?.id ?? '';
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(invoiceId)) return NextResponse.json({ ok: false }, { status: 400 });
  const [p] = await db.select().from(payments).where(eq(payments.providerRef, invoiceId));
  if (!p) return NextResponse.json({ ok: true });
  const invoice = await fetchInvoice(invoiceId);
  if (invoice.status === 'paid' && invoice.amount === p.total) await activatePayment(p.id, null);
  else if (['failed', 'canceled', 'expired', 'voided'].includes(invoice.status)) await failPayment(p.id);
  return NextResponse.json({ ok: true });
}
