'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useI18n } from '@/lib/i18n/client';
import type { ActionResult } from '@/lib/action-result';
import { useToast } from './toast';

export function SubmitButton({ children, variant = 'primary', className = '', disabled }: { children: ReactNode; variant?: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" className={`ui-btn ui-btn--${variant} ${className}`} disabled={pending || disabled} aria-busy={pending}>
      {pending ? t.common.saving : children}
    </button>
  );
}

/** Shows a toast for each new action result, and calls onSuccess once per success. */
export function useActionFeedback(state: ActionResult | null, onSuccess?: (s: ActionResult & { ok: true }) => void) {
  const toast = useToast();
  const last = useRef<ActionResult | null>(null);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.ok) {
      if (state.message) toast(state.message, 'ok');
      onSuccess?.(state);
    } else {
      toast(state.error, 'err');
    }
  }, [state, toast, onSuccess]);
}

export function Field({ label, htmlFor, hint, error, required, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <div className="ui-field">
      <label className="ui-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ui-req"> *</span> : null}
      </label>
      {children}
      {error ? <span className="ui-error">{error}</span> : hint ? <span className="ui-hint">{hint}</span> : null}
    </div>
  );
}

/**
 * useActionState with feedback raised inside the action itself, so the toast still shows when the
 * calling component unmounts on revalidation (e.g. an edited table row that moves to another page).
 */
export function useFeedbackAction(action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>, onSuccess?: () => void) {
  const toast = useToast();
  return useActionState(async (prev: ActionResult | null, form: FormData) => {
    const r = await action(prev, form);
    if (r.ok) {
      if (r.message) toast(r.message, 'ok');
      onSuccess?.();
    } else {
      toast(r.error, 'err');
    }
    return r;
  }, null);
}
