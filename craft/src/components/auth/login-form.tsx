'use client';

import { ArrowLeft, ArrowRight, MessageSquareText, Smartphone } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api, ApiClientError } from '@/lib/api-client';
import { formatLocal, normalizeSaudiMobile } from '@/lib/phone';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { OtpInput } from './otp-input';

interface Challenge {
  challengeId: string;
  phone: string;
  resendAt: string;
  devCode?: string;
}

/**
 * Phone, then the 6-digit code. The sign-up card on the landing page passes the number the visitor
 * already typed (initialPhone + autoSend) so the code is requested straight away.
 */
export function LoginForm({ next, initialPhone = '', autoSend = false }: { next?: string; initialPhone?: string; autoSend?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  useEffect(() => {
    if (!challenge) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [challenge]);

  const autoSent = useRef(false);
  useEffect(() => {
    // Once only, even when React re-runs effects (development strict mode).
    if (!autoSend || !initialPhone || autoSent.current) return;
    autoSent.current = true;
    void send();
    // Only on mount: the visitor submitted the sign-up card a moment ago.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!normalizeSaudiMobile(phone)) return setError(t.errors.invalid_phone);
    setBusy(true);
    try {
      setChallenge(await api<Challenge>('/auth/otp', { body: { phone } }));
      setCode('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (!challenge || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: string }>('/auth/verify', { body: { challengeId: challenge.challengeId, code: value, next } });
      router.replace(r.next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t.errors.generic);
      setCode('');
      setBusy(false);
    }
  }

  const resendIn = challenge ? Math.max(0, Math.ceil((new Date(challenge.resendAt).getTime() - now) / 1000)) : 0;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!challenge ? (
        <motion.form key="phone" onSubmit={send} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
          <Field label={t.auth.phone} error={error} htmlFor="phone">
            <div className="flex h-12 items-center overflow-hidden rounded-xl border border-line bg-surface-container-lowest shadow-sm focus-within:border-accent focus-within:ring-4 focus-within:ring-[var(--ring)]" dir="ltr">
              <span className="num flex h-full items-center gap-1.5 border-e border-line bg-surface-2 px-3 text-sm text-muted">🇸🇦 +966</span>
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus
                placeholder={t.auth.phonePlaceholder}
                className="num h-full min-w-0 flex-1 bg-transparent px-3 text-lg tracking-wider text-ink outline-none placeholder:text-faint"
              />
              <Smartphone className="me-3 size-5 text-faint" />
            </div>
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
            {busy ? t.auth.sending : t.auth.send}
          </Button>
          <p className="text-center text-xs text-muted">{t.auth.terms}</p>
        </motion.form>
      ) : (
        <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3.5 text-sm text-ink-2">
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-accent" />
            <span>
              {f(t.auth.codeSent, { phone: '' })}
              <span className="num font-semibold text-ink" dir="ltr">
                {formatLocal(challenge.phone)}
              </span>
            </span>
          </div>
          {challenge.devCode && (
            <div className="rounded-xl border border-dashed border-accent bg-accent-soft px-3 py-2 text-center text-sm text-ink">
              {f(t.auth.devCode, { code: '' })}
              <span className="num font-semibold tracking-[0.2em]" data-dev-code>
                {challenge.devCode}
              </span>
            </div>
          )}
          <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} invalid={!!error} />
          {error && <p className="text-center text-sm text-danger">{error}</p>}
          <Button variant="accent" size="lg" className="w-full" loading={busy} disabled={code.length !== 6} onClick={() => verify()}>
            {busy ? t.auth.verifying : t.auth.verify}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => setChallenge(null)} className="inline-flex items-center gap-1 text-muted hover:text-ink">
              <Back className="size-4" />
              {t.auth.changeNumber}
            </button>
            <button type="button" disabled={resendIn > 0 || busy} onClick={() => send()} className="text-ink-2 hover:text-ink disabled:text-faint">
              {resendIn > 0 ? f(t.auth.resendIn, { s: resendIn }) : t.auth.resend}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
