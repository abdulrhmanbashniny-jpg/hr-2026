import nodemailer from 'nodemailer';
import { decryptSecret } from '@/lib/crypto';
import { env } from '@/lib/env';
import { getPlatformSmtp, type PlatformSmtp } from '@/lib/platform-settings';
import type { TenantSettings } from '@/lib/settings';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

function smtpTransport(s: { host: string; port: number; secure: boolean; user: string; passwordEnc: string | null; fromName: string; fromEmail: string }) {
  return {
    transport: nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: s.user ? { user: s.user, pass: decryptSecret(s.passwordEnc) } : undefined,
    }),
    from: s.fromName ? `"${s.fromName.replace(/"/g, '')}" <${s.fromEmail || s.user}>` : s.fromEmail || s.user,
  };
}

/** Where the platform's own mail server comes from: the console, the environment, or nowhere. */
export async function platformMailSource(): Promise<'database' | 'env' | null> {
  const saved = await getPlatformSmtp();
  if (saved?.enabled && saved.host) return 'database';
  return env.smtp.host ? 'env' : null;
}

async function platformTransport() {
  const saved = await getPlatformSmtp();
  if (saved?.enabled && saved.host) return smtpTransport(saved);
  if (!env.smtp.host) return null;
  return {
    transport: nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
    }),
    from: env.smtp.from || env.smtp.user,
  };
}

/** The company's own SMTP when enabled, otherwise the platform mailer (console settings, then environment). */
export async function mailerFor(settings: TenantSettings | null) {
  const s = settings?.smtp;
  if (s?.enabled && s.host) return smtpTransport(s);
  return platformTransport();
}

export async function emailEnabled(settings: TenantSettings | null): Promise<boolean> {
  return !!(await mailerFor(settings));
}

export async function sendEmail(settings: TenantSettings | null, msg: { to: string; subject: string; html: string; text: string; attachments?: MailAttachment[] }) {
  const mailer = await mailerFor(settings);
  if (!mailer) throw new Error('No SMTP configured');
  await mailer.transport.sendMail({ from: mailer.from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text, attachments: msg.attachments });
}

export async function verifySmtp(settings: TenantSettings): Promise<void> {
  const mailer = await mailerFor(settings);
  if (!mailer) throw new Error('No SMTP configured');
  await mailer.transport.verify();
}

/** Checks and uses a platform mail server before it is saved. */
export async function testPlatformSmtp(s: PlatformSmtp, to: string, msg: { subject: string; html: string; text: string }) {
  const mailer = smtpTransport(s);
  await mailer.transport.verify();
  await mailer.transport.sendMail({ from: mailer.from, to, ...msg });
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Minimal RTL e-mail layout in the brand's colours. */
export function emailLayout(title: string, bodyHtml: string, footer: string): string {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f5f2ec;font-family:Tahoma,Arial,sans-serif;color:#17191c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e3ded5;border-radius:18px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #efebe4;font-size:20px;font-weight:bold">متابعة · ${escapeHtml(title)}</td></tr>
<tr><td style="padding:22px 24px;font-size:15px;line-height:1.8">${bodyHtml}</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #efebe4;font-size:12px;color:#5e6166">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}
