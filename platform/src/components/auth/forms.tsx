'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { acceptInvitation, register, requestPasswordReset, resetPassword, signIn } from '@/app/actions/auth';
import { Field, SubmitButton } from '@/components/ui/form';
import { Notice } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n/client';

function Result({ state }: { state: { ok: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (!state.ok) return <Notice tone="red">{state.error}</Notice>;
  return state.message ? <Notice tone="green">{state.message}</Notice> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="next" value={next ?? ''} />
      <Result state={state} />
      <Field label={t.auth.email} htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className="ui-input ui-input--ltr" />
      </Field>
      <Field label={t.auth.password} htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className="ui-input ui-input--ltr" />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password">{t.auth.forgot}</Link>
      </div>
      <SubmitButton className="ui-btn--block">{t.auth.login}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount} <Link href="/register">{t.auth.startTrial}</Link>
      </p>
    </form>
  );
}

export function RegisterForm({ promo }: { promo?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(register, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <Result state={state} />
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label={t.auth.companyName} htmlFor="companyName" required>
          <input id="companyName" name="companyName" required minLength={2} className="ui-input" />
        </Field>
        <Field label={t.auth.crNumber} htmlFor="crNumber">
          <input id="crNumber" name="crNumber" inputMode="numeric" pattern="\d{10}" className="ui-input ui-input--ltr" />
        </Field>
        <Field label={t.auth.fullName} htmlFor="name" required>
          <input id="name" name="name" required autoComplete="name" className="ui-input" />
        </Field>
        <Field label={t.auth.phone} htmlFor="phone">
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="05xxxxxxxx" className="ui-input ui-input--ltr" />
        </Field>
      </div>
      <Field label={t.auth.email} htmlFor="email" required>
        <input id="email" name="email" type="email" autoComplete="email" required className="ui-input ui-input--ltr" />
      </Field>
      <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} required>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="ui-input ui-input--ltr" />
      </Field>
      <Field label={t.auth.promoCode} htmlFor="promo" hint={t.auth.promoHint}>
        <input id="promo" name="promo" defaultValue={promo} className="ui-input ui-input--ltr" style={{ textTransform: 'uppercase' }} />
      </Field>
      <SubmitButton className="ui-btn--block ui-btn--lg">{t.auth.createAccount}</SubmitButton>
      <p className="text-center text-xs text-muted">{t.auth.agree}</p>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount} <Link href="/login">{t.auth.login}</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <Result state={state} />
      <Field label={t.auth.email} htmlFor="email">
        <input id="email" name="email" type="email" required className="ui-input ui-input--ltr" />
      </Field>
      <SubmitButton className="ui-btn--block">{t.auth.sendLink}</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login">{t.auth.login}</Link>
      </p>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPassword, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="token" value={token} />
      <Result state={state} />
      {state?.ok ? (
        <Link href="/login" className="ui-btn ui-btn--primary ui-btn--block">
          {t.auth.login}
        </Link>
      ) : (
        <>
          <Field label={t.auth.newPassword} htmlFor="password" hint={t.auth.passwordHint}>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="ui-input ui-input--ltr" />
          </Field>
          <SubmitButton className="ui-btn--block">{t.common.save}</SubmitButton>
        </>
      )}
    </form>
  );
}

export function InviteForm({ token, existing, email }: { token: string; existing: boolean; email: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(acceptInvitation, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="token" value={token} />
      <Result state={state} />
      <Field label={t.auth.email}>
        <input value={email} readOnly className="ui-input ui-input--ltr" />
      </Field>
      {existing ? null : (
        <>
          <Field label={t.auth.fullName} htmlFor="name" required>
            <input id="name" name="name" required className="ui-input" />
          </Field>
          <Field label={t.auth.phone} htmlFor="phone">
            <input id="phone" name="phone" type="tel" className="ui-input ui-input--ltr" />
          </Field>
        </>
      )}
      <Field label={t.auth.password} htmlFor="password" hint={existing ? undefined : t.auth.passwordHint}>
        <input id="password" name="password" type="password" required className="ui-input ui-input--ltr" autoComplete={existing ? 'current-password' : 'new-password'} />
      </Field>
      <SubmitButton className="ui-btn--block">{t.auth.acceptInvite}</SubmitButton>
    </form>
  );
}
