'use client';

import { CircleAlert, CircleCheck, IdCard, LoaderCircle, Search, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { api, ApiClientError } from '@/lib/api-client';
import { parseReferralCode } from '@/lib/codes/damm';
import { cn } from '@/lib/cn';
import { digitsOnly } from '@/lib/digits';
import type { PublicProfile } from '@/lib/craftsmen/public';
import { useI18n } from '@/lib/i18n/client';
import { profileStrings } from '@/lib/i18n/pages/profile';

type Note = { tone: 'error' | 'ok'; text: string } | null;

/**
 * "Check another member number": the Damm check digit is verified in the browser first, then the
 * number is looked up, and only a number that exists opens its profile. Used as the bar on top of
 * every profile and as the main action of the not-found and suspended pages.
 */
export function VerifyBar({ currentCode, framed = true, autoFocus }: { currentCode?: string; framed?: boolean; autoFocus?: boolean }) {
  const { t, locale } = useI18n();
  const s = profileStrings(locale);
  const router = useRouter();
  const [value, setValue] = useState(currentCode ?? '');
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const [navigating, startNav] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = digitsOnly(value);
    const parsed = parseReferralCode(digits);
    if (!parsed.ok) {
      setNote({ tone: 'error', text: parsed.reason === 'checksum' ? t.search.invalidChecksum : t.search.invalidLength });
      return;
    }
    if (parsed.code === currentCode) {
      setNote({ tone: 'ok', text: s.verify.same });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await api<PublicProfile>(`/craftsmen/${parsed.code}`);
      startNav(() => router.push(`/c/${parsed.code}?src=search`));
    } catch (err) {
      setNote({ tone: 'error', text: err instanceof ApiClientError && err.status === 404 ? t.search.notFound : err instanceof ApiClientError ? err.message : t.errors.generic });
    } finally {
      setBusy(false);
    }
  }

  const loading = busy || navigating;
  const form = (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-space-xs sm:flex-row sm:items-start lg:w-auto">
      <div className="w-full sm:w-80">
        <div className="relative">
          <IdCard className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-on-surface-variant" aria-hidden />
          <input
            value={value}
            onChange={(e) => {
              setValue(digitsOnly(e.target.value).slice(0, 6));
              setNote(null);
            }}
            inputMode="numeric"
            autoComplete="off"
            autoFocus={autoFocus}
            aria-label={s.verify.label}
            aria-invalid={note?.tone === 'error' || undefined}
            aria-describedby="verify-note"
            placeholder={s.verify.placeholder}
            className="code-id h-12 w-full rounded-xl border border-transparent bg-surface-container-low ps-10 pe-4 text-body-lg text-on-surface transition outline-none placeholder:font-sans placeholder:text-body-md placeholder:tracking-normal placeholder:text-on-surface-variant focus:border-accent-2 focus:bg-surface-container-lowest focus:ring-[3px] focus:ring-[var(--ring)] aria-[invalid=true]:border-[#EF4444]"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="press flex h-12 w-full shrink-0 items-center justify-center gap-space-xs rounded-xl bg-gradient-to-r from-secondary to-on-secondary-container px-space-lg text-label-lg text-on-primary shadow-sm transition hover:brightness-105 disabled:opacity-70 sm:w-auto"
      >
        {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
        <span>{s.verify.action}</span>
      </button>
    </form>
  );

  const message = (
    <div id="verify-note" aria-live="polite" className="empty:hidden">
      <AnimatePresence mode="wait">
        {note && (
          <motion.p
            key={note.text}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn('mt-space-sm flex items-center gap-1.5 text-body-sm', note.tone === 'error' ? 'text-danger' : 'text-success')}
          >
            {note.tone === 'error' ? <CircleAlert className="size-4 shrink-0" /> : <CircleCheck className="size-4 shrink-0" />}
            {note.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  if (!framed)
    return (
      <div className="w-full">
        {form}
        {message}
      </div>
    );

  return (
    <section className="mb-space-lg w-full rounded-2xl bg-surface-container-lowest p-space-md shadow-sm md:p-space-lg" aria-label={s.verify.title}>
      <div className="flex flex-col items-stretch justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex items-center gap-space-sm">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary-fixed/40 text-secondary">
            <ShieldCheck className="size-6" />
          </div>
          <div className="flex min-w-0 flex-col">
            <h2 className="text-headline-sm text-primary">{s.verify.title}</h2>
            <p className="max-w-xl text-body-sm text-on-surface-variant">{s.verify.subtitle}</p>
          </div>
        </div>
        <div className="lg:shrink-0">{form}</div>
      </div>
      <div className="lg:text-end">{message}</div>
    </section>
  );
}
