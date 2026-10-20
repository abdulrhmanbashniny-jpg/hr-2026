import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { DESIGNER } from '@/lib/designer';
import { env } from '@/lib/env';
import { getI18n, getTheme } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const title = `${t.meta.product} — ${t.meta.tagline}`;
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: title, template: `%s · ${t.meta.product}` },
    description: t.meta.description,
    keywords: t.meta.keywords,
    applicationName: t.meta.product,
    authors: [{ name: 'عبدالرحمن سالم باشنيني', url: DESIGNER.linkedin }],
    creator: 'عبدالرحمن سالم باشنيني',
    icons: { icon: '/icon.svg' },
    openGraph: {
      type: 'website',
      siteName: t.meta.product,
      title,
      description: t.meta.description,
      locale: t.meta.locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: t.meta.locale === 'ar' ? ['en_US'] : ['ar_SA'],
      images: [{ url: '/og.png', width: 1200, height: 630, alt: t.meta.ogAlt }],
    },
    twitter: { card: 'summary_large_image', title, description: t.meta.description, images: ['/og.png'] },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f7' },
    { media: '(prefers-color-scheme: dark)', color: '#05060a' },
  ],
};

// Applies the dark theme before paint when the user follows the device setting.
const themeScript = `(function(){try{var d=document.documentElement;if(!d.getAttribute('data-theme')){d.setAttribute('data-theme',window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getI18n();
  const theme = await getTheme();
  return (
    <html lang={locale} dir={t.meta.dir} data-theme={theme === 'system' ? undefined : theme} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400..800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="ui-root">
        <div className="ambient" aria-hidden="true">
          <span className="ambient__orb" />
          <span className="ambient__orb" />
          <span className="ambient__orb" />
          <span className="ambient__orb" />
        </div>
        <I18nProvider locale={locale} t={t}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
