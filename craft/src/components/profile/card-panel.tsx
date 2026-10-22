'use client';

import { Download, QrCode, ScanLine } from 'lucide-react';
import { useState } from 'react';
import { MembershipCard, type CardData } from '@/components/card/membership-card';
import { Dialog } from '@/components/ui/dialog';
import { fmtCode } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import { profileStrings } from '@/lib/i18n/pages/profile';

/** The member card as the client sees it, with "save contact" and a large QR to scan from the screen. */
export function CardPanel({ data, src }: { data: CardData; src: string }) {
  const { t, locale } = useI18n();
  const s = profileStrings(locale);
  const [qr, setQr] = useState(false);
  const qrSrc = `/api/v1/craftsmen/${data.code}/qr?target=profile&src=qr`;
  const btn = 'press flex h-11 items-center justify-center gap-space-xs rounded-xl bg-surface-container-lowest px-space-sm text-label-md text-primary shadow-sm transition hover:bg-surface-container';

  return (
    <div className="flex flex-col gap-space-md">
      <MembershipCard data={data} flippable={false} />
      <div className="grid grid-cols-2 gap-space-xs">
        <a href={`/api/v1/craftsmen/${data.code}/vcard?src=${src}`} rel="nofollow" className={btn} title={s.card.downloadHint}>
          <Download className="size-[18px]" aria-hidden />
          <span>{s.card.download}</span>
        </a>
        <button type="button" onClick={() => setQr(true)} className={btn}>
          <ScanLine className="size-[18px]" aria-hidden />
          <span>{s.card.showQr}</span>
        </button>
      </div>

      <Dialog open={qr} onClose={() => setQr(false)} title={s.card.qrTitle}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-space-sm grid size-12 place-items-center rounded-full bg-secondary-fixed/50 text-secondary">
            <QrCode className="size-6" />
          </div>
          <p className="mb-space-md max-w-xs text-body-sm text-on-surface-variant">{s.card.qrBody}</p>
          <div className="mb-space-md rounded-2xl bg-surface-container-low p-space-md shadow-inner">
            <div className="rounded-xl bg-white p-space-sm">
              <img src={qrSrc} alt={t.card.qrProfileHint} className="size-56 max-w-full sm:size-60" />
            </div>
          </div>
          <div className="code-id mb-space-xs text-code-referral text-secondary">{fmtCode(data.code)}</div>
          <div className="mb-space-md text-label-md text-on-surface-variant">{data.name}</div>
          <div className="grid w-full grid-cols-2 gap-space-xs">
            <a href={qrSrc} download={`member-${data.code}-qr.svg`} className="press flex h-11 items-center justify-center gap-space-xs rounded-xl border border-line bg-surface-container-lowest text-label-md text-primary transition hover:bg-surface-container-low">
              <Download className="size-[18px]" aria-hidden />
              {s.card.downloadQr}
            </a>
            <button type="button" onClick={() => setQr(false)} className="press h-11 rounded-xl bg-primary text-label-md text-on-primary transition hover:bg-primary-container">
              {t.common.close}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
