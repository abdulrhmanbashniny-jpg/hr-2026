import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { normalizeDigits } from '@/lib/digits';
import { env } from '@/lib/env';
import type { InvoiceExtraction } from './types';

const ExtractionSchema = z.object({
  is_tax_invoice: z.boolean().describe('True only for a Saudi tax invoice or simplified tax invoice (فاتورة ضريبية / فاتورة ضريبية مبسطة).'),
  seller_name: z.string().nullable(),
  seller_vat_number: z.string().nullable().describe('The seller VAT registration number exactly as printed, digits only.'),
  invoice_number: z.string().nullable(),
  issued_at: z.string().nullable().describe('Issue date and time as printed, in ISO 8601 (YYYY-MM-DDTHH:MM). Gregorian calendar.'),
  total_with_vat: z.number().nullable().describe('Grand total including VAT, in SAR.'),
  vat_amount: z.number().nullable().describe('Total VAT amount, in SAR.'),
  currency: z.string().nullable(),
  paint_line_items: z.number().nullable().describe('How many line items are paint or painting supplies.'),
  editing_suspected: z.boolean().describe('True only when there are visible signs the photo was edited: mismatched fonts on amounts, pasted digits, misaligned totals, screen moiré of a forged print.'),
  notes: z.string().nullable().describe('One short sentence on anything a reviewer should know, or null.'),
});

const SYSTEM = `You read photographs of purchase receipts for a Saudi loyalty programme for painters.
Extract the fields exactly as printed. Receipts are in Arabic, English or both; write numbers with Western digits.
Never guess: use null for anything you cannot read clearly. Amounts are in SAR unless the receipt says otherwise.
A ZATCA tax invoice shows the seller's 15-digit VAT number (starts and ends with 3), a date, totals with VAT, and usually a QR code.`;

const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function aiConfigured(): boolean {
  return !!env.ai.apiKey;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ai.apiKey, timeout: 60_000, maxRetries: 2 });
  return client;
}

/**
 * Asks Claude to read the invoice photo into structured fields. Returns null when extraction is not
 * configured, the image type is unsupported, the model declines, or the API fails; the pipeline then
 * relies on the QR code and human review instead.
 */
export async function extractInvoice(image: Buffer, mime: string): Promise<InvoiceExtraction | null> {
  if (!aiConfigured() || !SUPPORTED.has(mime) || image.length > MAX_IMAGE_BYTES) return null;
  const model = env.ai.model;
  try {
    const response = await anthropic().beta.messages.parse({
      model,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractionSchema) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg', data: image.toString('base64') } },
            { type: 'text', text: 'Extract the invoice fields from this photo.' },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
    const o = response.parsed_output;
    const digits = (v: string | null) => (v ? normalizeDigits(v).replace(/\D/g, '') || null : null);
    return {
      isTaxInvoice: o.is_tax_invoice,
      sellerName: o.seller_name,
      sellerVat: digits(o.seller_vat_number),
      invoiceNumber: o.invoice_number,
      issuedAt: o.issued_at,
      total: o.total_with_vat,
      vat: o.vat_amount,
      currency: o.currency,
      paintLineItems: o.paint_line_items,
      editingSuspected: o.editing_suspected,
      notes: o.notes,
      model: response.model,
    };
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) console.warn('[invoice-ai] rate limited');
    else if (err instanceof Anthropic.APIError) console.error('[invoice-ai] API error', err.status, err.message);
    else console.error('[invoice-ai] failed', err);
    return null;
  }
}
