'use client';

import { Contact, Phone, Share2 } from 'lucide-react';
import { WhatsAppIcon } from '@/components/brand/icons';
import { buttonClass } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';

export function ProfileActions({ code, name, hasWhatsapp, acceptsCalls, src }: { code: string; name: string; hasWhatsapp: boolean; acceptsCalls: boolean; src: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const base = `/api/v1/craftsmen/${code}`;
  async function share() {
    const url = `${location.origin}/c/${code}?src=link`;
    try {
      if (navigator.share) await navigator.share({ title: name, text: `${t.profile.verifiedBy} · ${t.profile.memberNo} ${code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t.common.copied);
      }
    } catch {
      // The person closed the share sheet.
    }
  }
  return (
    <div className="grid gap-2.5">
      {hasWhatsapp && (
        <a href={`${base}/contact?channel=whatsapp&src=${src}`} rel="nofollow noopener" target="_blank" className={buttonClass('whatsapp', 'lg', 'w-full')}>
          <WhatsAppIcon className="size-5" />
          {t.profile.whatsapp}
        </a>
      )}
      <div className="grid grid-cols-3 gap-2">
        {acceptsCalls && (
          <a href={`${base}/contact?channel=call&src=${src}`} rel="nofollow" className={buttonClass('secondary', 'md', 'w-full flex-col !h-auto gap-1 py-2.5 text-xs')}>
            <Phone className="size-5" />
            {t.profile.call}
          </a>
        )}
        <a href={`${base}/vcard?src=${src}`} rel="nofollow" className={buttonClass('secondary', 'md', `w-full flex-col !h-auto gap-1 py-2.5 text-xs ${acceptsCalls ? '' : 'col-span-2'}`)}>
          <Contact className="size-5" />
          {t.profile.saveContact}
        </a>
        <button type="button" onClick={share} className={buttonClass('secondary', 'md', 'w-full flex-col !h-auto gap-1 py-2.5 text-xs')}>
          <Share2 className="size-5" />
          {t.common.share}
        </button>
      </div>
    </div>
  );
}
