import { unstable_rethrow } from 'next/navigation';
import { ForbiddenError } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';
import type { ActionResult } from './action-result';

/** Runs a server action body, mapping permission and unexpected errors to a localized result. */
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    const { t } = await getI18n();
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.reason === 'read_only' ? t.common.readOnly : err.reason === 'suspended' ? t.common.suspended : t.common.forbidden };
    }
    console.error(err);
    return { ok: false, error: t.common.error };
  }
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function optStr(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v === '' ? null : v;
}

export function num(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

export function lines(form: FormData, key: string): string[] {
  return str(form, key)
    .split(/\r?\n|,|،/)
    .map((s) => s.trim())
    .filter(Boolean);
}
