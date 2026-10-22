'use client';

import { KeyRound, MessageCircle, MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api, ApiClientError } from '@/lib/api-client';
import { normalizeSaudiMobile } from '@/lib/phone';
import { useI18n } from '@/lib/i18n/client';
import { PasswordInput, PhoneInput } from './inputs';
import { SmsLogin } from './sms-login';

/**
 * Phone and password. A forgotten password goes through the team (no SMS needed); the SMS code is
 * offered as a second way in only once an SMS provider is connected.
 */
export function LoginForm({ next, smsEnabled = false, supportWhatsapp = null }: { next?: string; smsEnabled?: boolean; supportWhatsapp?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'sms'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!normalizeSaudiMobile(phone)) return setError(t.errors.invalid_phone);
    if (!password) return setError(t.errors.invalid_credentials);
    setBusy(true);
    try {
      const r = await api<{ next: string }>('/auth/password', { body: { phone, password, next } });
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t.errors.generic);
      setBusy(false);
    }
  }

  if (mode === 'sms') {
    return (
      <div className="space-y-5">
        <SmsLogin next={next} />
        <button type="button" onClick={() => setMode('password')} className="mx-auto flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <KeyRound className="size-4" />
          {t.auth.usePassword}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label={t.auth.phone} htmlFor="phone">
        <PhoneInput id="phone" value={phone} onChange={setPhone} autoFocus />
      </Field>
      <Field label={t.auth.password} htmlFor="password" error={error}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder={t.auth.passwordPlaceholder} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
        {busy ? t.auth.signingIn : t.auth.signIn}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={() => setForgot((v) => !v)} className="text-ink-2 underline-offset-2 hover:text-ink hover:underline" aria-expanded={forgot}>
          {t.auth.forgot}
        </button>
        <span className="text-muted">
          {t.auth.noAccount}{' '}
          <Link href={next ? `/join?next=${encodeURIComponent(next)}` : '/join'} className="font-semibold text-primary-container underline underline-offset-2">
            {t.auth.createAccount}
          </Link>
        </span>
      </div>

      {forgot && (
        <div className="space-y-3 rounded-2xl bg-surface-2 p-3.5 text-sm text-ink-2">
          <p>{t.auth.forgotHelp}</p>
          {supportWhatsapp ? (
            <a href={`https://wa.me/${supportWhatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#047857] hover:underline">
              <MessageCircle className="size-4" />
              {t.auth.contactTeam}
            </a>
          ) : (
            <Link href="/#contact" className="inline-flex items-center gap-1.5 font-semibold text-primary-container hover:underline">
              <MessageCircle className="size-4" />
              {t.auth.contactPage}
            </Link>
          )}
        </div>
      )}

      {smsEnabled && (
        <button type="button" onClick={() => setMode('sms')} className="mx-auto flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <MessageSquareText className="size-4" />
          {t.auth.useSms}
        </button>
      )}
      <p className="text-center text-xs text-muted">{t.auth.terms}</p>
    </form>
  );
}
