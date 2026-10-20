import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { getI18n, getTheme } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: `${t.meta.product} — ${t.meta.tagline}`, template: `%s · ${t.meta.product}` },
    description: t.meta.tagline,
    icons: { icon: '/icon.svg' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f2ec' },
    { media: '(prefers-color-scheme: dark)', color: '#111214' },
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
          href="https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="ui-root">
        <I18nProvider locale={locale} t={t}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
