'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BadgeCheck, CircleAlert, LoaderCircle, MapPin, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { api, ApiClientError } from '@/lib/api-client';
import { parseReferralCode } from '@/lib/codes/damm';
import { cn } from '@/lib/cn';
import { digitsOnly } from '@/lib/digits';
import type { PublicProfile } from '@/lib/craftsmen/public';
import { useI18n } from '@/lib/i18n/client';

function useLookup(code: string | null) {
  return useQuery({
    queryKey: ['lookup', code],
    queryFn: ({ signal }) => api<PublicProfile>(`/craftsmen/${code}`, { signal }),
    enabled: !!code,
    staleTime: 60_000,
    retry: false,
  });
}

/** The number check happens in the browser first (Damm check digit), so typos never hit the server. */
export function UniversalSearch({ size = 'lg', autoFocus }: { size?: 'lg' | 'sm'; autoFocus?: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState('');
  const digits = digitsOnly(value);
  const check = useMemo(() => (digits.length >= 6 ? parseReferralCode(digits) : null), [digits]);
  const code = check?.ok ? check.code : null;
  const q = useLookup(code);
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  const error = check && !check.ok ? (check.reason === 'checksum' ? t.search.invalidChecksum : t.search.invalidLength) : q.error instanceof ApiClientError && q.error.status === 404 ? t.search.notFound : null;

  function go() {
    if (code && q.data) router.push(`/c/${code}?src=search`);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className={cn('glass flex items-center gap-2 rounded-2xl p-1.5 shadow-md transition focus-within:shadow-glow', size === 'lg' ? 'ps-4' : 'ps-3')}
      >
        <Search className={cn('shrink-0 text-muted', size === 'lg' ? 'size-5' : 'size-4')} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 12))}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label={t.search.label}
          aria-invalid={!!error}
          placeholder={size === 'lg' ? t.search.placeholder : t.search.short}
          className={cn('num min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-faint', size === 'lg' ? 'h-12 text-xl tracking-[0.2em]' : 'h-9 text-base tracking-[0.15em]')}
        />
        <button type="submit" disabled={!q.data} className={cn('press inline-flex items-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-40', size === 'lg' ? 'amber-gradient h-12 px-5 text-accent-ink' : 'h-9 bg-primary px-3 text-sm text-primary-ink')}>
          {q.isFetching ? <LoaderCircle className="size-4 animate-spin" /> : <Arrow className="size-4" />}
          {size === 'lg' && t.search.action}
        </button>
      </form>
      <div className="min-h-6 px-2 pt-2" aria-live="polite">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert className="size-4" />
              {error}
            </motion.p>
          ) : q.data ? (
            <motion.button
              key="hit"
              type="button"
              onClick={go}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="press surface flex w-full items-center gap-3 p-3 text-start hover:shadow-md"
            >
              <Avatar name={q.data.displayName} src={q.data.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-semibold text-ink">
                  <span className="truncate">{q.data.displayName}</span>
                  {q.data.identityVerified && <BadgeCheck className="size-4 shrink-0 text-accent" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{t.tiers.short[q.data.tier]}</span>·
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="size-3" />
                    {locale === 'ar' ? q.data.city.nameAr : q.data.city.nameEn}
                  </span>
                </div>
              </div>
              <span className="text-xs font-medium text-success">{t.search.found}</span>
            </motion.button>
          ) : size === 'lg' ? (
            <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted">
              {t.search.hint}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Type a member number anywhere on a public page (outside a text field) and a pill appears;
 * Enter opens the profile. Validation is local, so only valid numbers are looked up.
 */
export function TypeAnywhere() {
  const { t } = useI18n();
  const router = useRouter();
  const [buf, setBuf] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const check = buf.length >= 6 ? parseReferralCode(buf) : null;
  const code = check?.ok ? check.code : null;
  const q = useLookup(code);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input,textarea,select,[contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const d = digitsOnly(e.key);
      if (d.length === 1) {
        setBuf((b) => (b + d).slice(-7));
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setBuf(''), 6000);
      } else if (e.key === 'Enter' && code && q.data) {
        router.push(`/c/${code}?src=search`);
        setBuf('');
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        setBuf((b) => (e.key === 'Escape' ? '' : b.slice(0, -1)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [code, q.data, router]);

  return (
    <AnimatePresence>
      {buf.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
          <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg">
            <span className="num text-xl font-semibold tracking-[0.2em] text-ink">{buf}</span>
            <span className="text-sm text-muted">
              {check && !check.ok ? (check.reason === 'checksum' ? t.search.invalidChecksum : t.search.invalidLength) : q.data ? `${q.data.displayName} — ${t.search.typeAnywhere}` : q.isError ? t.search.notFound : t.search.shortcut}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
