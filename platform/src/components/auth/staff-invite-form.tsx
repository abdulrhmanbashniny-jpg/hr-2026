'use client';

import { useActionState } from 'react';
import { acceptStaffInvite } from '@/app/actions/staff-invite';
import { Notice } from '@/components/ui/card';
import { Field, SubmitButton } from '@/components/ui/form';
import { useI18n } from '@/lib/i18n/client';

export function StaffInviteForm({ token, email, existing }: { token: string; email: string; existing: boolean }) {
  const { t } = useI18n();
  const c = t.console.team;
  const [state, action] = useActionState(acceptStaffInvite, null);
  return (
    <form action={action} className="flex flex-col gap-3.5">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <div role="alert">
          <Notice tone="red">{state.error}</Notice>
        </div>
      ) : null}
      <Field label={t.auth.email}>
        <input value={email} readOnly className="ui-input ui-input--ltr" />
      </Field>
      {existing ? (
        <Notice tone="blue">{c.acceptExisting}</Notice>
      ) : (
        <Field label={t.auth.fullName} htmlFor="si-name" required>
          <input id="si-name" name="name" required minLength={2} autoComplete="name" className="ui-input" />
        </Field>
      )}
      <Field label={t.auth.newPassword} htmlFor="si-pass" hint={t.auth.passwordHint} required>
        <input id="si-pass" name="password" type="password" required minLength={10} autoComplete="new-password" className="ui-input ui-input--ltr" />
      </Field>
      <Field label={c.confirmPassword} htmlFor="si-confirm" required>
        <input id="si-confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" className="ui-input ui-input--ltr" />
      </Field>
      <SubmitButton className="ui-btn--block">{c.acceptButton}</SubmitButton>
    </form>
  );
}
