'use client';

import { Copy, Phone, Share2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand/icons';
import { useToast } from '@/components/ui/toast';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { profileStrings } from '@/lib/i18n/pages/profile';

/**
 * Call and WhatsApp go through the tracked redirect (/contact), so the number is never in the page
 * and every contact is counted for the craftsman. Copy and share hand out the clean profile link.
 */
export function ProfileActions({ code, name, hasWhatsapp, acceptsCalls, src, profileUrl }: { code: string; name: string; hasWhatsapp: boolean; acceptsCalls: boolean; src: string; profileUrl: string }) {
  const { locale } = useI18n();
  const s = profileStrings(locale);
  const toast = useToast();
  const base = `/api/v1/craftsmen/${code}/contact`;
  const display = profileUrl.replace(/^https?:\/\//, '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast(s.actions.copied);
    } catch {
      toast(profileUrl, 'info');
    }
  }
  async function share() {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: name, text: f(s.actions.shareText, { name, code }), url: `${profileUrl}?src=link` });
    } catch {
      // The person closed the share sheet.
    }
  }

  const square = 'press grid size-12 shrink-0 place-items-center rounded-xl bg-surface-container-low text-primary transition hover:bg-surface-container';
  return (
    <div className="flex flex-col items-stretch justify-between gap-space-md pt-space-md sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-space-sm">
        {acceptsCalls && (
          <a href={`${base}?channel=call&src=${src}`} rel="nofollow" className="press flex h-12 flex-1 items-center justify-center gap-space-xs rounded-xl bg-primary px-space-md text-label-lg text-on-primary shadow-sm transition hover:bg-primary-container sm:flex-none">
            <Phone className="size-5" aria-hidden />
            <span>{s.actions.call}</span>
          </a>
        )}
        {hasWhatsapp && (
          <a
            href={`${base}?channel=whatsapp&src=${src}`}
            rel="nofollow noopener"
            target="_blank"
            className="press flex h-12 flex-1 items-center justify-center gap-space-xs rounded-xl bg-secondary-fixed/45 px-space-md text-label-lg text-on-secondary-fixed transition hover:bg-secondary-fixed/70 sm:flex-none"
          >
            <WhatsAppIcon className="size-5 text-[#128C4B]" />
            <span>{s.actions.whatsapp}</span>
          </a>
        )}
      </div>
      <div className="flex items-center gap-space-xs">
        <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl bg-surface-container-low px-space-sm sm:flex-none">
          <span className="num truncate text-body-sm text-on-surface-variant" dir="ltr">
            {display}
          </span>
        </div>
        <button type="button" onClick={share} className={square} aria-label={s.actions.share} title={s.actions.share}>
          <Share2 className="size-5" />
        </button>
        <button type="button" onClick={copy} className={square} aria-label={s.actions.copy} title={s.actions.copy}>
          <Copy className="size-5" />
        </button>
      </div>
    </div>
  );
}
