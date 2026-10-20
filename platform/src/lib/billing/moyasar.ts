import { env } from '@/lib/env';

const API = 'https://api.moyasar.com/v1';

function authHeader() {
  return `Basic ${Buffer.from(`${env.moyasar.secretKey}:`).toString('base64')}`;
}

export function moyasarEnabled(): boolean {
  return !!env.moyasar.secretKey;
}

export interface MoyasarInvoice {
  id: string;
  status: 'initiated' | 'paid' | 'failed' | 'refunded' | 'canceled' | 'on_hold' | 'expired' | 'voided';
  amount: number;
  currency: string;
  url: string;
  metadata?: Record<string, string>;
}

/** Creates a hosted Moyasar invoice (mada, Apple Pay, cards). Amount in halalas. */
export async function createInvoice(input: { amount: number; description: string; paymentId: string; tenantId: string }): Promise<MoyasarInvoice> {
  const res = await fetch(`${API}/invoices`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: input.amount,
      currency: 'SAR',
      description: input.description,
      callback_url: `${env.appUrl}/api/billing/moyasar/webhook`,
      success_url: `${env.appUrl}/api/billing/moyasar/return?payment=${input.paymentId}`,
      back_url: `${env.appUrl}/app/settings/billing`,
      metadata: { payment_id: input.paymentId, tenant_id: input.tenantId },
    }),
  });
  if (!res.ok) throw new Error(`Moyasar invoice failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as MoyasarInvoice;
}

export async function fetchInvoice(id: string): Promise<MoyasarInvoice> {
  const res = await fetch(`${API}/invoices/${encodeURIComponent(id)}`, { headers: { Authorization: authHeader() }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Moyasar fetch failed (${res.status})`);
  return (await res.json()) as MoyasarInvoice;
}
