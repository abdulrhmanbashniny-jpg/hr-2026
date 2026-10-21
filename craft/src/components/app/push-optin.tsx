'use client';

import { BellRing, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n/client';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Web Push opt-in. On iPhone, push works only after "Add to Home Screen", so it says so instead. */
export function PushOptIn({ vapidKey }: { vapidKey: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState<'unsupported' | 'ios-install' | 'default' | 'granted' | 'denied' | 'loading'>('loading');

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey) {
      setState(ios && !standalone ? 'ios-install' : 'unsupported');
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default');
    });
  }, [vapidKey]);

  async function enable() {
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
      await api('/push/subscribe', { body: sub.toJSON() });
      setState('granted');
      toast(t.home.pushEnabled);
    } catch {
      setState(Notification.permission === 'denied' ? 'denied' : 'default');
    }
  }

  if (state === 'loading' || state === 'unsupported' || state === 'granted') return null;
  return (
    <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{state === 'ios-install' ? <Smartphone className="size-5" /> : <BellRing className="size-5" />}</div>
      <div className="flex-1">
        <h3 className="font-semibold">{state === 'ios-install' ? t.home.installTitle : t.home.pushTitle}</h3>
        <p className="text-sm text-muted">{state === 'ios-install' ? t.home.installBody : state === 'denied' ? t.home.pushDenied : t.home.pushBody}</p>
      </div>
      {state === 'default' && (
        <Button variant="primary" size="sm" onClick={enable}>
          {t.home.pushEnable}
        </Button>
      )}
    </div>
  );
}
