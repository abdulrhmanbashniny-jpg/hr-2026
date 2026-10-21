import { env } from '@/lib/env';

export interface SmsResult {
  ok: boolean;
  /** Only the console driver: the text is logged instead of sent. */
  logged?: boolean;
}

async function postForm(url: string, form: Record<string, string>, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

/** Sends a text through the configured provider. Unifonic and Twilio both deliver to Saudi numbers. */
export async function sendSms(toE164: string, text: string): Promise<SmsResult> {
  try {
    switch (env.sms.driver) {
      case 'unifonic':
        return {
          ok: await postForm('https://el.cloud.unifonic.com/rest/SMS/messages', {
            AppSid: env.sms.unifonicAppSid,
            SenderID: env.sms.unifonicSender,
            Recipient: toE164.replace(/^\+/, ''),
            Body: text,
            responseType: 'JSON',
          }),
        };
      case 'twilio':
        return {
          ok: await postForm(
            `https://api.twilio.com/2010-04-01/Accounts/${env.sms.twilioSid}/Messages.json`,
            { To: toE164, From: env.sms.twilioFrom, Body: text },
            { authorization: `Basic ${Buffer.from(`${env.sms.twilioSid}:${env.sms.twilioToken}`).toString('base64')}` },
          ),
        };
      default:
        console.info(`[sms:console] → ${toE164}: ${text}`);
        return { ok: true, logged: true };
    }
  } catch (err) {
    console.error('[sms] send failed', err);
    return { ok: false };
  }
}
