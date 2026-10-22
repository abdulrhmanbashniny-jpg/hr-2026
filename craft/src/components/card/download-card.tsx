'use client';

import { Download, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { CardData } from '@/components/card/membership-card';
import { useToast } from '@/components/ui/toast';
import { downloadBlob, renderCardPng } from '@/lib/card-image';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/client';

/** Saves the member card as a PNG, drawn in the browser with the same layout as the on-screen card. */
export function DownloadCardButton({ data, className, label }: { data: CardData; className?: string; label?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const joined = new Date(data.memberSince);
      const blob = await renderCardPng(data, {
        product: t.meta.product,
        brandLine: t.card.brandLine,
        tierBadge: t.tiers.badge[data.tier],
        nameLabel: t.profile.nameLabel,
        classification: `${t.card.classification}: ${data.classification || t.tiers.role[data.tier]}`,
        memberNo: t.card.memberNo,
        since: `${t.card.memberSince} ${String(joined.getMonth() + 1).padStart(2, '0')}/${joined.getFullYear()}`,
        active: t.card.active,
        scan: t.card.scanToVerify,
        dir: t.meta.dir as 'rtl' | 'ltr',
      });
      if (!blob) throw new Error('canvas');
      downloadBlob(blob, `member-card-${data.code}.png`);
    } catch {
      toast(t.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={run} disabled={busy} className={cn('press inline-flex items-center justify-center gap-2 disabled:opacity-60', className)}>
      {busy ? <LoaderCircle className="size-[18px] animate-spin" /> : <Download className="size-[18px]" />}
      {label ?? t.card.downloadCard}
    </button>
  );
}
