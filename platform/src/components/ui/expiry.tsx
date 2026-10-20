import { bucketForDays, daysUntil, type ExpiryBucket } from '@/lib/dates';
import type { Dictionary } from '@/lib/i18n/ar';
import { dayCount, f, type Locale } from '@/lib/i18n/format';
import { toHijri } from '@/lib/dates';

export function expiryText(days: number | null, t: Dictionary, locale: Locale): string {
  if (days === null) return t.expiry.none;
  if (days === 0) return t.expiry.today;
  return days < 0 ? f(t.expiry.ago, { days: dayCount(days, locale) }) : f(t.expiry.left, { days: dayCount(days, locale) });
}

/** Five-bucket expiry badge: dot + words + day count, never colour alone. */
export function ExpiryBadge({ date, today, t, locale, showDate = false }: { date: string | null | undefined; today: string; t: Dictionary; locale: Locale; showDate?: boolean }) {
  const days = daysUntil(date, today);
  const bucket: ExpiryBucket = bucketForDays(days);
  const hijri = date ? toHijri(date) : null;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="ui-expiry" data-bucket={bucket} title={date ? `${date}${hijri ? ` · ${hijri} هـ` : ''}` : undefined}>
        <span className="ui-expiry__dot" aria-hidden />
        {expiryText(days, t, locale)}
      </span>
      {showDate && date ? <span className="ui-num text-xs text-muted">{date}</span> : null}
    </span>
  );
}
