'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError } from '@/lib/api-client';
import { PASSWORD_MIN } from '@/lib/auth/password-rules';
import { useI18n } from '@/lib/i18n/client';
import { PasswordInput } from './inputs';

export function ChangePasswordForm({ next, hasPassword, forced }: { next?: string; hasPassword: boolean; forced: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'current' | 'password'; message: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (hasPassword && !current) return setError({ field: 'current', message: t.errors.wrong_password });
    if ([...password].length < PASSWORD_MIN) return setError({ field: 'password', message: t.errors.password_too_short });
    setBusy(true);
    try {
      const r = await api<{ next: string }>('/me/password', { body: { current: hasPassword ? current : undefined, password, next } });
      toast(t.auth.passwordSaved);
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      setError({ field: code === 'wrong_password' ? 'current' : 'password', message: err instanceof ApiClientError ? err.message : t.errors.generic });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {hasPassword && (
        <Field label={forced ? t.auth.temporaryPassword : t.auth.currentPassword} htmlFor="current-password" error={error?.field === 'current' ? error.message : null}>
          <PasswordInput id="current-password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus />
        </Field>
      )}
      <Field label={t.auth.newPassword} htmlFor="new-password" hint={t.auth.passwordHint} error={error?.field === 'password' ? error.message : null}>
        <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" placeholder={t.auth.newPasswordPlaceholder} autoFocus={!hasPassword} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
        {t.auth.savePassword}
      </Button>
    </form>
  );
}
