'use client';

import { useEffect } from 'react';

/** Registers the service worker (offline card, Web Push) once the page is idle. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
    if ('requestIdleCallback' in window) window.requestIdleCallback(register);
    else setTimeout(register, 1500);
  }, []);
  return null;
}
