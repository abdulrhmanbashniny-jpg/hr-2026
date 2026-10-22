'use client';

import { Contact, Copy, Download, Nfc, Share2, Wallet, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DownloadCardButton } from '@/components/card/download-card';
import { MembershipCard, type CardData } from '@/components/card/membership-card';
import { PhotoEditor } from './photo-editor';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n/client';

interface NDEFReaderLike {
  write(message: { records: { recordType: string; data: string }[] }): Promise<void>;
}

export function CardStudio({ data, googleWallet }: { data: CardData; googleWallet: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [target, setTarget] = useState<'profile' | 'join'>('profile');
  const [nfc, setNfc] = useState<'unsupported' | 'idle' | 'writing'>('unsupported');
  const [walletBusy, setWalletBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    setOrigin(location.origin);
    if ('NDEFReader' in window) setNfc('idle');
    // Keep a copy of this page for offline use (shown from the service worker cache).
    navigator.serviceWorker?.controller?.postMessage({ type: 'cache-card', url: location.pathname });
  }, []);
  const link = target === 'join' ? `${origin}/join?ref=${data.code}` : `${origin}/c/${data.code}`;

  async function writeNfc() {
    try {
      setNfc('writing');
      const Reader = (window as unknown as { NDEFReader: new () => NDEFReaderLike }).NDEFReader;
      await new Reader().write({ records: [{ recordType: 'url', data: `${origin}/c/${data.code}?src=nfc` }] });
      toast(t.card.nfcDone);
    } catch {
      toast(t.errors.generic, 'error');
    } finally {
      setNfc('idle');
    }
  }

  async function addToGoogleWallet() {
    setWalletBusy(true);
    try {
      const { saveUrl } = await api<{ saveUrl: string }>('/wallet/pass/google');
      window.location.href = saveUrl;
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
      setWalletBusy(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: data.name, url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast(t.common.copied);
      }
    } catch {
      // Share sheet closed.
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
      <div className="space-y-5">
        <div className="flex justify-center">
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { value: 'profile', label: t.card.qrProfile },
              { value: 'join', label: t.card.qrJoin },
            ]}
          />
        </div>
        <MembershipCard key={target} data={data} qrTarget={target} initialFlipped={target === 'join'} />
        <p className="text-center text-sm text-muted">{target === 'join' ? t.card.qrJoinHint : t.card.qrProfileHint}</p>
      </div>
      <div className="space-y-3">
        <PhotoEditor name={data.name} photoUrl={data.photoUrl ?? null} />
        <DownloadCardButton data={data} className="h-12 w-full rounded-xl bg-primary-container text-label-lg text-white shadow-sm hover:bg-primary" />
        <div className="surface flex items-center gap-2 p-2 ps-4">
          <span className="num min-w-0 flex-1 truncate text-sm text-ink-2">{link.replace(/^https?:\/\//, '')}</span>
          <Button
            size="sm"
            variant="secondary"
            icon={<Copy className="size-4" />}
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              toast(t.common.copied);
            }}
          >
            {t.common.copy}
          </Button>
        </div>
        <Button variant="accent" size="lg" className="w-full" icon={<Share2 className="size-5" />} onClick={share}>
          {t.common.share}
        </Button>
        <Button variant="secondary" size="lg" className="w-full" icon={<Wallet className="size-5" />} loading={walletBusy} onClick={addToGoogleWallet} disabled={!googleWallet}>
          {t.card.googleWallet}
        </Button>
        {!googleWallet && <p className="-mt-1 text-center text-xs text-muted">{t.card.walletUnavailable}</p>}
        <div className="grid grid-cols-2 gap-3">
          <a href={`/api/v1/craftsmen/${data.code}/vcard?src=direct`} className={buttonClass('secondary', 'md', 'w-full')}>
            <Contact className="size-4" />
            {t.card.vcard}
          </a>
          <a href={`/api/v1/craftsmen/${data.code}/qr?target=${target}&src=qr`} download={`hirfa-${data.code}-qr.svg`} className={buttonClass('secondary', 'md', 'w-full')}>
            <Download className="size-4" />
            QR
          </a>
        </div>
        <Button variant="secondary" size="lg" className="w-full" icon={<Nfc className="size-5" />} onClick={writeNfc} disabled={nfc !== 'idle'} loading={nfc === 'writing'}>
          {nfc === 'writing' ? t.card.nfcReady : t.card.nfc}
        </Button>
        {nfc === 'unsupported' && <p className="-mt-1 text-center text-xs text-muted">{t.card.nfcUnsupported}</p>}
        <div className="flex items-center justify-center gap-2 pt-2">
          <Badge tone="info" icon={<WifiOff className="size-3.5" />}>
            {t.card.offlineReady}
          </Badge>
          <Badge>
            {t.card.appleWallet} · {t.common.soon}
          </Badge>
        </div>
      </div>
    </div>
  );
}
