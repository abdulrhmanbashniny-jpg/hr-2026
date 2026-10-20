import { asc, eq } from 'drizzle-orm';
import { ArrowLeft, BellRing, Check, FileSpreadsheet, IdCard, Layers, Lock, RefreshCw, Send, ShieldCheck, Sparkles, Truck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { DesignerCredit } from '@/components/app/credit';
import { BrandGlyph } from '@/components/ui/brand';
import { db } from '@/db';
import { plans } from '@/db/schema';
import { formatSar } from '@/lib/billing/pricing';
import { DESIGNER } from '@/lib/designer';
import { env } from '@/lib/env';
import { APP_VERSION } from '@/lib/releases';
import { f, getI18n } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export const metadata = { alternates: { canonical: '/' } };

const FEATURE_ICONS = [FileSpreadsheet, Lock, RefreshCw, Layers, BellRing, Wallet];
const FEATURE_TILES = ['var(--accent)', 'var(--accent-2)', 'var(--teal)', 'var(--purple)', 'var(--saffron)', 'var(--green)'];

export default async function Landing() {
  const { t, locale } = await getI18n();
  const L = t.landing;
  const list = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder));
  const popularIdx = list.length > 2 ? 1 : -1;
  // Structured data so search and answer engines can describe the product accurately.
  const prices = list.map((p) => p.priceMonthly / 100).filter((n) => n > 0);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${env.appUrl}/#app`,
        name: t.meta.product,
        alternateName: locale === 'ar' ? 'Mutabaa' : 'متابعة',
        url: env.appUrl,
        image: `${env.appUrl}/og.png`,
        description: t.meta.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        softwareVersion: APP_VERSION,
        inLanguage: ['ar', 'en'],
        areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
        featureList: L.features.map((x) => `${x.t}: ${x.d}`),
        ...(prices.length ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'SAR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } } : {}),
        creator: { '@id': `${env.appUrl}/#designer` },
      },
      { '@type': 'Person', '@id': `${env.appUrl}/#designer`, name: 'عبدالرحمن سالم باشنيني', alternateName: 'Abdulrahman Salem Bashnainy', sameAs: [DESIGNER.linkedin] },
    ],
  };
  return (
    <div className="marketing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <header className="lp-nav glass">
        <Link href="/" className="flex items-center gap-2.5" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
          <span className="ui-side__logo" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <BrandGlyph size={18} />
          </span>
          <span className="font-display text-lg font-bold">{t.meta.product}</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <a href="#features" className="ui-btn ui-btn--ghost ui-btn--sm hide-sm">
            {L.nav.features}
          </a>
          <a href="#pricing" className="ui-btn ui-btn--ghost ui-btn--sm hide-sm">
            {L.nav.pricing}
          </a>
          <Link href="/contact" className="ui-btn ui-btn--ghost ui-btn--sm hide-sm">
            {t.credit.contact}
          </Link>
          <Link href="/login" className="ui-btn ui-btn--ghost ui-btn--sm">
            {L.nav.login}
          </Link>
          <Link href="/register" className="ui-btn ui-btn--primary ui-btn--sm">
            {L.nav.start}
          </Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <span className="lp-badge glass">
            <Sparkles size={14} />
            {L.badge}
          </span>
          <h1 className="lp-title">
            {L.heroTitleA}
            <br />
            <span className="text-gradient">{L.heroTitleB}</span>
          </h1>
          <p className="lp-sub">{L.heroSub}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="ui-btn ui-btn--primary ui-btn--lg">
              {L.heroCta}
              <ArrowLeft size={18} className="ltr:rotate-180" />
            </Link>
            <Link href="/login" className="ui-btn ui-btn--outline ui-btn--lg">
              {L.heroSecondary}
            </Link>
          </div>
          <ul className="lp-trust">
            {L.trust.map((x) => (
              <li key={x}>
                <Check size={15} />
                {x}
              </li>
            ))}
          </ul>

          <div className="lp-stage" aria-hidden="true">
            <div className="lp-mock glass">
              <div className="lp-mock__bar">
                <span />
                <span />
                <span />
              </div>
              <div className="lp-mock__body">
                <aside className="lp-mock__side">
                  <span className="ui-side__logo" style={{ width: 30, height: 30, borderRadius: 9 }}>
                    <BrandGlyph size={16} />
                  </span>
                  {[IdCard, ShieldCheck, Truck, FileSpreadsheet, BellRing].map((I, k) => (
                    <span key={k} className={`lp-mock__nav ${k === 0 ? 'is-active' : ''}`}>
                      <I size={15} />
                    </span>
                  ))}
                </aside>
                <div className="lp-mock__main">
                  <b className="font-display text-base">{L.mock.title}</b>
                  <div className="lp-mock__kpis">
                    {(
                      [
                        [L.mock.residents, '58', 'var(--accent)'],
                        [L.mock.saudization, '31.4%', 'var(--green)'],
                        [L.mock.fleet, '72%', 'var(--accent-2)'],
                        [L.mock.alerts, '87', 'var(--saffron)'],
                      ] as const
                    ).map(([label, v, c]) => (
                      <div key={label} className="lp-mock__kpi">
                        <span className="lp-mock__dot" style={{ background: c }} />
                        <span className="text-[11px] text-muted">{label}</span>
                        <span className="ui-num text-xl font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="lp-mock__panel">
                    <div className="ui-matrix__bar">
                      {(
                        [
                          ['expired', 4],
                          ['d30', 6],
                          ['d60', 5],
                          ['d90', 8],
                          ['valid', 35],
                        ] as const
                      ).map(([b, n]) => (
                        <div key={b} className="ui-matrix__seg" data-bucket={b} style={{ flex: n }} />
                      ))}
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {(
                        [
                          ['expired', locale === 'ar' ? 'إقامة منتهية — سائق شاحنة ثقيلة' : 'Iqama expired — heavy truck driver'],
                          ['d30', locale === 'ar' ? 'شهادة الزكاة — باقٍ 12 يوماً' : 'Zakat certificate — 12 days left'],
                          ['d60', locale === 'ar' ? 'بطاقة تشغيل — باقٍ 40 يوماً' : 'Operating card — 40 days left'],
                        ] as const
                      ).map(([b, label]) => (
                        <span key={b} className="ui-expiry" data-bucket={b} style={{ alignSelf: 'flex-start' }}>
                          <span className="ui-expiry__dot" />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="lp-float glass glass--thick">
              <span className="lp-float__icon">
                <Send size={16} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold">{L.mock.notifTitle}</div>
                <div className="text-xs text-muted">{L.mock.notifBody}</div>
                <div className="mt-2 flex gap-1.5">
                  <span className="ui-pill ui-pill--green">{L.mock.renewed}</span>
                  <span className="ui-pill ui-pill--gray">{L.mock.snooze}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <h2 className="lp-h2">{L.stepsTitle}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {L.steps.map((s, k) => (
              <div key={s.t} className="ui-card ui-card--interactive flex flex-col gap-2">
                <span className="lp-step">{k + 1}</span>
                <h3 className="text-lg font-bold">{s.t}</h3>
                <p className="text-ink-2">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="lp-section">
          <h2 className="lp-h2">{L.featuresTitle}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {L.features.map((feat, idx) => {
              const Icon = FEATURE_ICONS[idx] ?? FileSpreadsheet;
              return (
                <div key={feat.t} className="ui-card ui-card--interactive flex flex-col gap-3">
                  <span className="ui-kpi__icon" style={{ ['--tile' as string]: FEATURE_TILES[idx % FEATURE_TILES.length], width: 42, height: 42, borderRadius: 13 }}>
                    <Icon size={20} />
                  </span>
                  <h3 className="text-lg font-bold">{feat.t}</h3>
                  <p className="text-ink-2">{feat.d}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="lp-section">
          <h2 className="lp-h2">{L.pricingTitle}</h2>
          <p className="-mt-6 mb-12 text-center text-muted">{L.pricingSub}</p>
          <div className="grid items-stretch gap-4 md:grid-cols-3">
            {list.map((p, idx) => (
              <div key={p.id} className={`ui-card flex flex-col gap-4 ${idx === popularIdx ? 'lp-price--popular' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold">{locale === 'ar' ? p.nameAr : p.nameEn}</h3>
                  {idx === popularIdx ? <span className="ui-pill ui-pill--blue">{L.popular}</span> : null}
                </div>
                <p className="text-sm text-muted">{locale === 'ar' ? p.descriptionAr : p.descriptionEn}</p>
                <div className="flex items-baseline gap-1">
                  <span className="ui-num font-display text-4xl font-bold">{formatSar(p.priceMonthly, locale)}</span>
                  <span className="text-sm text-muted">{L.perMonthShort}</span>
                </div>
                <ul className="flex flex-col gap-2 text-sm">
                  {[
                    p.maxEmployees ? f(t.billing.employees, { n: p.maxEmployees }) : `${t.common.unlimited} — ${t.nav.residents}`,
                    p.maxVehicles ? f(t.billing.vehicles, { n: p.maxVehicles }) : `${t.common.unlimited} — ${t.nav.fleet}`,
                    p.maxUsers ? f(t.billing.users, { n: p.maxUsers }) : `${t.common.unlimited} — ${t.settings.tabs.members}`,
                  ].map((x) => (
                    <li key={x} className="flex items-center gap-2">
                      <Check size={15} style={{ color: 'var(--green)' }} />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href={`/register?plan=${p.code}`} className={`ui-btn mt-auto ${idx === popularIdx ? 'ui-btn--primary' : 'ui-btn--outline'}`}>
                  {L.heroCta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="lp-footer">
        <span className="flex items-center gap-2">
          <span className="ui-side__logo" style={{ width: 24, height: 24, borderRadius: 7 }}>
            <BrandGlyph size={13} />
          </span>
          {L.footer}
        </span>
        <DesignerCredit />
      </footer>
    </div>
  );
}
