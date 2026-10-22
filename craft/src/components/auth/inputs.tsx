'use client';

import { Eye, EyeOff, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/client';

const frame =
  'flex h-12 items-center overflow-hidden rounded-xl border border-line bg-surface-container-lowest shadow-sm focus-within:border-accent focus-within:ring-4 focus-within:ring-[var(--ring)]';

/** Saudi mobile number with the +966 prefix shown; digits read left to right in both languages. */
export function PhoneInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={frame} dir="ltr">
      <span className="num flex h-full items-center gap-1.5 border-e border-line bg-surface-2 px-3 text-sm text-muted">🇸🇦 +966</span>
      <input
        id={id}
        name="phone"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        placeholder={t.auth.phonePlaceholder}
        className="num h-full min-w-0 flex-1 bg-transparent px-3 text-lg tracking-wider text-ink outline-none placeholder:text-faint"
      />
      <Smartphone className="me-3 size-5 text-faint" />
    </div>
  );
}

/** A password box with a show/hide toggle, so a mistyped password on a phone keyboard can be checked. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className={frame}>
      <input
        id={id}
        name={autoComplete === 'new-password' ? 'new-password' : 'password'}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        dir="ltr"
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-faint"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.auth.hide : t.auth.show}
        aria-pressed={visible}
        className="grid h-full w-12 shrink-0 place-items-center text-muted hover:text-ink"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}
