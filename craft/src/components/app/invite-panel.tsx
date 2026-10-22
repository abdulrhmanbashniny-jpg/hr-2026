'use client';

import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WhatsAppIcon } from '@/components/brand/icons';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { f } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';

export function InvitePanel({ code }: { code: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(location.origin), []);
  const url = `${origin}/join?ref=${code}`;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="mx-auto size-36 shrink-0 rounded-2xl border border-line bg-white p-3 sm:mx-0">
        <img src={`/api/v1/craftsmen/${code}/qr?target=join`} alt="" className="size-full" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="text-sm font-medium text-ink">{t.referrals.linkTitle}</div>
        <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas p-1.5 ps-3">
          <span className="num min-w-0 flex-1 truncate text-sm text-ink-2">{url.replace(/^https?:\/\//, '')}</span>
          <Button
            size="sm"
            variant="secondary"
            icon={<Copy className="size-4" />}
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              toast(t.common.copied);
            }}
          >
            {t.common.copy}
          </Button>
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(f(t.referrals.inviteMessage, { url }))}`} target="_blank" rel="noopener" className="press inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-5 font-medium text-white shadow-sm hover:bg-[#1a9249]">
          <WhatsAppIcon className="size-5" />
          {t.referrals.shareWhatsapp}
        </a>
      </div>
    </div>
  );
}
