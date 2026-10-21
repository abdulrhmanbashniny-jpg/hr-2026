import { decryptSecret } from '@/lib/crypto';
import type { TenantSettings } from '@/lib/settings';
import { normalizeSaudiPhone, waDeepLink } from './wa-link';
import { postToWebhook } from '@/lib/net/outbound';

export { normalizeSaudiPhone, waDeepLink };

export function whatsappAutomatic(settings: TenantSettings): boolean {
  const w = settings.whatsapp;
  if (w.mode === 'cloud_api') return !!w.cloudPhoneNumberId && !!w.cloudTokenEnc;
  if (w.mode === 'webhook') return !!w.webhookUrl;
  return false;
}

/**
 * Sends a WhatsApp message automatically.
 * - cloud_api: Meta WhatsApp Cloud API. Outside the 24-hour service window Meta only delivers approved
 *   templates, so when a template name is configured the text is passed as its single body parameter.
 * - webhook: POSTs {to, message, document_url} to the company's provider (Unifonic, Taqnyat, etc.).
 */
export async function sendWhatsApp(settings: TenantSettings, to: string, message: string, documentUrl?: string): Promise<void> {
  const phone = normalizeSaudiPhone(to);
  if (!phone) throw new Error('Invalid phone number');
  const w = settings.whatsapp;
  if (w.mode === 'cloud_api') {
    const token = decryptSecret(w.cloudTokenEnc);
    const body = w.cloudTemplateName
      ? {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: w.cloudTemplateName,
            language: { code: w.cloudTemplateLang || 'ar' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 1000) }] }],
          },
        }
      : documentUrl
        ? { messaging_product: 'whatsapp', to: phone, type: 'document', document: { link: documentUrl, caption: message.slice(0, 1000) } }
        : { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message.slice(0, 4000), preview_url: true } };
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(w.cloudPhoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`WhatsApp Cloud API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return;
  }
  if (w.mode === 'webhook') {
    const auth = decryptSecret(w.webhookAuthHeaderEnc);
    const res = await postToWebhook(w.webhookUrl, { to: phone, message, document_url: documentUrl ?? null }, auth ? { Authorization: auth } : {});
    if (res.status < 200 || res.status >= 300) throw new Error(`WhatsApp webhook ${res.status}`);
    return;
  }
  throw new Error('WhatsApp automatic sending is not configured (deep-link mode)');
}
