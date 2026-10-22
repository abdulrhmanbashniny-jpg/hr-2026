'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { appHomeStrings } from '@/lib/i18n/pages/app-home';

/** Shares the invite link (or copies it where the share sheet is not available). */
export function ShareCodeButton({ code, className }: { code: string; className?: string }) {
  const { locale } = useI18n();
  const s = appHomeStrings(locale);
  const toast = useToast();
  async function share() {
    const link = `${location.origin}/join?ref=${code}`;
    const text = f(s.inviteText, { code, link });
    try {
      if (navigator.share) await navigator.share({ text, url: link });
      else {
        await navigator.clipboard.writeText(text);
        toast(f(s.inviteCopied, { code }));
      }
      navigator.vibrate?.(10);
    } catch {
      // Share sheet dismissed.
    }
  }
  return (
    <button type="button" onClick={share} className={className}>
      <Share2 className="size-5" />
      {s.shareCode}
    </button>
  );
}

/** WhatsApp share of the invite link with the member's code. */
export function WhatsAppInvite({ code, className, label }: { code: string; className?: string; label: string }) {
  const { locale } = useI18n();
  const s = appHomeStrings(locale);
  return (
    <button
      type="button"
      onClick={() => {
        const link = `${location.origin}/join?ref=${code}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(f(s.inviteText, { code, link }))}`, '_blank', 'noopener');
      }}
      className={className}
    >
      {label}
    </button>
  );
}
