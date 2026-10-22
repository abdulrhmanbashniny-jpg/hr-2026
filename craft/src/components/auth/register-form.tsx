'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api, ApiClientError } from '@/lib/api-client';
import { PASSWORD_MIN } from '@/lib/auth/password-rules';
import { normalizeSaudiMobile } from '@/lib/phone';
import { useI18n } from '@/lib/i18n/client';
import { PasswordInput, PhoneInput } from './inputs';

/**
 * A new account: mobile number and a password. The card details come next, on the onboarding page
 * (the landing sign-up card has already kept them in the browser, so they are filled in there).
 */
export function RegisterForm({ initialPhone = '', autoFocusPassword = false }: { initialPhone?: string; autoFocusPassword?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'phone' | 'password'; message: string; taken?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!normalizeSaudiMobile(phone)) return setError({ field: 'phone', message: t.errors.invalid_phone });
    if ([...password].length < PASSWORD_MIN) return setError({ field: 'password', message: t.errors.password_too_short });
    setBusy(true);
    try {
      const r = await api<{ next: string }>('/auth/register', { body: { phone, password } });
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      const message = err instanceof ApiClientError ? err.message : t.errors.generic;
      setError({ field: code === 'invalid_phone' || code === 'phone_taken' ? 'phone' : 'password', message, taken: code === 'phone_taken' });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field
        label={t.auth.phone}
        htmlFor="reg-phone"
        error={
          error?.field === 'phone' ? (
            <>
              {error.message}{' '}
              {error.taken && (
                <Link href="/login" className="font-semibold underline underline-offset-2">
                  {t.auth.signInInstead}
                </Link>
              )}
            </>
          ) : null
        }
      >
        <PhoneInput id="reg-phone" value={phone} onChange={setPhone} autoFocus={!autoFocusPassword} />
      </Field>
      <Field label={t.auth.password} htmlFor="reg-password" hint={t.auth.passwordHint} error={error?.field === 'password' ? error.message : null}>
        <PasswordInput id="reg-password" value={password} onChange={setPassword} autoComplete="new-password" placeholder={t.auth.newPasswordPlaceholder} autoFocus={autoFocusPassword} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
        {busy ? t.auth.registering : t.auth.register}
      </Button>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{' '}
        <Link href="/login" className="font-semibold text-primary-container underline underline-offset-2">
          {t.auth.signInInstead}
        </Link>
      </p>
      <p className="text-center text-xs text-muted">{t.auth.terms}</p>
    </form>
  );
}
