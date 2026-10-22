import { Globe, Phone } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/icons';
import { f, getI18n } from '@/lib/i18n';
import { landingStrings } from '@/lib/i18n/pages/landing';
import { getBrand, listActiveProducts } from '@/lib/products/service';
import { LanguageSwitch } from './language-switch';

/** Footer from the design: brand, the factory that runs the platform, links and contact. */
export async function SiteFooter() {
  const { t, locale } = await getI18n();
  const s = landingStrings(locale);
  const brand = await getBrand().catch(() => null);
  const factory = brand ? (locale === 'ar' ? brand.factoryNameAr : brand.factoryNameEn) : null;
  const hasProducts = (await listActiveProducts().catch(() => [])).length > 0;
  const links = [
    { href: '/#top', label: s.footer.links.home },
    { href: '/#about', label: s.footer.links.about },
    ...(hasProducts ? [{ href: '/#products', label: s.header.nav.products }] : []),
    { href: '/#rewards', label: s.header.nav.rewards },
    { href: '/login', label: t.common.signIn },
  ];
  return (
    <footer id="contact" className="scroll-mt-24 border-t border-line bg-surface-container-lowest">
      <div className="mx-auto grid max-w-[1280px] gap-space-xl px-margin-mobile py-space-xl md:grid-cols-3 lg:px-margin">
        <div>
          <div className="flex items-center gap-space-sm">
            <LogoMark size={40} />
            <div className="leading-tight">
              <div className="text-headline-sm text-primary">{t.meta.product}</div>
              <div className="text-body-sm text-on-surface-variant">{t.meta.tagline}</div>
            </div>
          </div>
          {factory && <p className="mt-space-md text-body-sm text-on-surface-variant">{f(s.footer.operatedBy, { factory })}</p>}
        </div>
        <nav className="flex flex-wrap content-start gap-x-space-lg gap-y-space-sm text-label-md text-on-surface-variant">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-on-surface">
              {l.label}
            </Link>
          ))}
        </nav>
        <div>
          <div className="text-label-lg text-primary">{s.footer.contactTitle}</div>
          <p className="mt-1 text-body-sm text-on-surface-variant">{s.footer.contactBody}</p>
          <div className="mt-space-sm flex flex-col gap-1 text-body-sm">
            {brand?.phone && (
              <a href={`tel:${brand.phone}`} className="inline-flex items-center gap-2 text-primary-container hover:underline">
                <Phone className="size-4" />
                <span className="num">{brand.phone}</span>
              </a>
            )}
            {brand?.websiteUrl && (
              <a href={brand.websiteUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-primary-container hover:underline">
                <Globe className="size-4" />
                {s.footer.website}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-space-sm px-margin-mobile py-space-md text-body-sm text-muted sm:flex-row sm:items-center lg:px-margin">
          <span>{f(s.footer.rights, { year: new Date().getFullYear(), product: t.meta.product })}</span>
          <div className="flex items-center gap-space-md">
            <span>{s.footer.slogan}</span>
            <LanguageSwitch compact />
          </div>
        </div>
      </div>
    </footer>
  );
}
