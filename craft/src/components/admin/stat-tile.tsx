import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Label · value · optional hint. Values use proportional figures at display size. */
export function StatTile({ label, value, hint, icon, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; href?: string; tone?: 'accent' | 'danger' }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        <span className={cn(tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-faint')}>{icon}</span>
      </div>
      <div className="mt-1.5 font-mono text-[26px] leading-tight font-semibold text-ink" dir="ltr" style={{ textAlign: 'start', unicodeBidi: 'plaintext' }}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="surface lift block p-4">
      {body}
    </Link>
  ) : (
    <div className="surface p-4">{body}</div>
  );
}
