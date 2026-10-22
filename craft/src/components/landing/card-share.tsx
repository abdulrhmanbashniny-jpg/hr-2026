'use client';

import { Link2, QrCode, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WhatsAppIcon } from '@/components/brand/icons';
import { DownloadCardButton } from '@/components/card/download-card';
import { MembershipCard, type CardData } from '@/components/card/membership-card';
import { useToast } from '@/components/ui/toast';
import { f, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { landingStrings } from '@/lib/i18n/pages/landing';

/** "بطاقة العضوية الذكية للمعلم": a real member card with the share actions beside it. */
export function CardShare({ data, joined, active, earned, own }: { data: CardData; joined: number; active: number; earned: number; own: boolean }) {
  const { t, locale } = useI18n();
  const s = landingStrings(locale);
  const toast = useToast();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(location.origin), []);
  const link = `${origin}/join?ref=${data.code}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(f(s.card.waMessage, { product: t.meta.product, link }))}`;
  const action = 'press flex h-12 w-full items-center justify-center gap-2 rounded-xl text-label-lg transition';

  return (
    <div className="grid grid-cols-1 items-center gap-space-xl lg:grid-cols-2">
      <div className="order-2 lg:order-1">
        <h3 className="text-headline-md text-primary">{s.card.shareTitle}</h3>
        <p className="mt-space-sm text-body-md text-on-surface-variant">{s.card.shareBody}</p>
        <div className="mt-space-lg space-y-space-sm">
          <a href={wa} target="_blank" rel="noopener" className={`${action} bg-whatsapp text-white shadow-sm hover:brightness-95`}>
            <WhatsAppIcon className="size-5" />
            {s.card.whatsapp}
          </a>
          <DownloadCardButton data={data} label={s.card.download} className={`${action} border border-line bg-surface-container-lowest text-primary-container shadow-xs hover:bg-canvas`} />
          <div className="grid grid-cols-2 gap-space-sm">
            <a href={`/api/v1/craftsmen/${data.code}/qr?target=join&src=qr`} download={`qr-${data.code}.svg`} className={`${action} border border-line bg-surface-container-lowest text-primary-container shadow-xs hover:bg-canvas`}>
              <QrCode className="size-5" />
              {s.card.qr}
            </a>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => undefined);
                toast(s.card.linkCopied);
              }}
              className={`${action} border border-line bg-surface-container-lowest text-primary-container shadow-xs hover:bg-canvas`}
            >
              <Link2 className="size-5" />
              {s.card.copyLink}
            </button>
          </div>
        </div>
        <div className="mt-space-lg flex items-center justify-between gap-space-md rounded-xl border border-line bg-surface-container-lowest p-space-md shadow-sm">
          <div className="flex items-center gap-space-sm">
            <div className="grid size-11 place-items-center rounded-lg bg-canvas text-primary-container">
              <Users className="size-5" />
            </div>
            <div>
              <div className="text-label-lg text-primary">{s.card.referralsTitle}</div>
              <div className="text-body-sm text-on-surface-variant">{s.card.referralsBody(joined, active)}</div>
            </div>
          </div>
          <div className="text-end">
            <div className="rounded-lg bg-primary-container px-space-sm py-1 text-label-lg text-secondary-fixed-dim">
              <span className="num">{fmtNumber(earned)}</span>
            </div>
            <div className="mt-1 text-label-sm text-muted">{s.card.pointsHint}</div>
          </div>
        </div>
      </div>
      <div className="order-1 lg:order-2">
        <MembershipCard data={data} qrTarget={own ? 'join' : 'profile'} />
        <p className="mt-space-sm text-center text-body-sm text-muted">{own ? s.card.yours : s.card.example}</p>
      </div>
    </div>
  );
}
