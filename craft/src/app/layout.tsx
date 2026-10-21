import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { env } from '@/lib/env';
import { getI18n } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import './globals.css';

const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-arabic', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-plex-mono', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const title = `${t.meta.product} — ${t.meta.tagline}`;
  return {
    metadataBase: new URL(env.appUrl),
    title: { default: title, template: `%s · ${t.meta.product}` },
    description: t.meta.description,
    applicationName: t.meta.product,
    appleWebApp: { capable: true, title: t.meta.product, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    openGraph: { type: 'website', siteName: t.meta.product, title, description: t.meta.description, locale: t.meta.locale === 'ar' ? 'ar_SA' : 'en_US' },
    twitter: { card: 'summary_large_image', title, description: t.meta.description },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#07121d' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getI18n();
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html lang={locale} dir={t.meta.dir} className={`${plexArabic.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale} t={t}>
          <Providers nonce={nonce}>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
