import type { MetadataRoute } from 'next';
import { getI18n } from '@/lib/i18n';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t } = await getI18n();
  return {
    name: `${t.meta.product} — ${t.meta.tagline}`,
    short_name: t.meta.product,
    description: t.meta.description,
    lang: t.meta.locale,
    dir: t.meta.dir as 'rtl' | 'ltr',
    start_url: '/app?src=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f8fafc',
    theme_color: '#102A43',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: t.nav.scan, url: '/app/invoices/scan', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: t.nav.card, url: '/app/card', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
