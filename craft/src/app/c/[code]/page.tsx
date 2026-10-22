import { BadgeCheck, CalendarCheck, CircleCheck, IdCard, MapPin, Quote, ShieldCheck, Star, Award } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { after } from 'next/server';
import { CardPanel } from '@/components/profile/card-panel';
import { Estimator } from '@/components/profile/estimator';
import { LiveSeal } from '@/components/profile/live-seal';
import { PortfolioGallery } from '@/components/profile/portfolio-gallery';
import { ProfileActions } from '@/components/profile/profile-actions';
import { ReviewsSection } from '@/components/profile/reviews';
import { Stars } from '@/components/profile/stars';
import { TrustBreakdown, TrustRing } from '@/components/profile/trust-ring';
import { VerifyBar } from '@/components/profile/verify-bar';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { TypeAnywhere } from '@/components/public/universal-search';
import { Avatar } from '@/components/ui/avatar';
import { parseReferralCode } from '@/lib/codes/damm';
import { leadSource } from '@/lib/craftsmen/lookup';
import { getPublicProfile } from '@/lib/craftsmen/public';
import { recordLead } from '@/lib/craftsmen/service';
import { env } from '@/lib/env';
import { f, fmtMonthYear, getI18n } from '@/lib/i18n';
import { profileStrings } from '@/lib/i18n/pages/profile';
import { requestFingerprint } from '@/lib/signals';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ src?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const s = profileStrings(locale);
  const parsed = parseReferralCode((await params).code);
  const p = parsed.ok ? await getPublicProfile(parsed.code) : null;
  if (!p) return { title: t.profile.notFoundTitle, robots: { index: false } };
  const city = locale === 'ar' ? p.city.nameAr : p.city.nameEn;
  const vars = { name: p.displayName, tier: t.tiers.short[p.tier], role: t.tiers.role[p.tier], city, code: p.code };
  return {
    title: f(s.meta.title, vars),
    description: f(s.meta.description, vars),
    alternates: { canonical: `/c/${p.code}` },
    openGraph: p.avatarUrl ? { images: [{ url: p.avatarUrl }] } : undefined,
  };
}

const AVAILABILITY_DOT = { available: 'bg-emerald-500', busy: 'bg-amber-500', away: 'bg-slate-400' } as const;

export default async function CraftsmanProfilePage({ params, searchParams }: Props) {
  const { t, locale } = await getI18n();
  const s = profileStrings(locale);
  const raw = (await params).code;
  const parsed = parseReferralCode(raw);
  if (!parsed.ok) notFound();
  if (parsed.code !== raw) permanentRedirect(`/c/${parsed.code}`);
  const p = await getPublicProfile(parsed.code);
  if (!p) notFound();

  const src = leadSource((await searchParams).src);
  const fp = await requestFingerprint();
  after(() => recordLead(p.id, 'profile_view', src, fp.ipHash).catch(() => undefined));

  const city = locale === 'ar' ? p.city.nameAr : p.city.nameEn;
  const tradeNames = p.trades.map((tr) => (locale === 'ar' ? tr.nameAr : tr.nameEn));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HousePainter',
    name: p.displayName,
    identifier: p.code,
    areaServed: city,
    address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'SA' },
    ...(p.reviews.count > 0 && p.reviews.average !== null ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.reviews.average, reviewCount: p.reviews.count } } : {}),
  };
  const checks = [
    { ok: p.identityVerified, icon: IdCard, yes: s.card.identity, no: s.card.identityNo },
    { ok: p.licenseVerified, icon: BadgeCheck, yes: s.card.license, no: s.card.licenseNo },
    { ok: p.stats.approvedInvoices > 0, icon: ShieldCheck, yes: s.card.invoices(p.stats.approvedInvoices), no: s.card.invoices(0) },
  ];

  return (
    <>
      <SiteHeader />
      <TypeAnywhere />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <main className="bg-surface pb-space-xl">
        <div className="mx-auto max-w-[1280px] px-margin-mobile pt-space-lg lg:px-margin">
          <VerifyBar currentCode={p.code} />

          <div className="mt-space-lg grid grid-cols-1 gap-space-lg lg:grid-cols-12">
            {/* Profile header card */}
            <section className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg lg:col-span-8" aria-labelledby="craftsman-name">
              <div className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-start">
                <div className="flex items-start gap-space-md">
                  <div className="relative shrink-0">
                    <Avatar name={p.displayName} src={p.avatarUrl} size={96} className="rounded-2xl shadow-sm ring-2 ring-secondary/20" />
                    {p.identityVerified && (
                      <span className="absolute -bottom-2 -start-2 grid size-8 place-items-center rounded-full bg-primary-container text-secondary-fixed-dim shadow-md ring-2 ring-surface-container-lowest" title={s.header.identityBadge}>
                        <CircleCheck className="size-[18px]" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 id="craftsman-name" className="text-headline-lg-mobile text-primary sm:text-headline-lg">
                      {f(s.header.nameTitle[p.tier], { name: p.displayName })}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-space-sm gap-y-1 text-body-md text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-4 text-secondary" />
                        {p.district ? `${city} · ${p.district}` : city}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${AVAILABILITY_DOT[p.availability]}`} />
                        {t.availability[p.availability]}
                      </span>
                    </div>
                    <div className="mt-space-sm inline-flex items-center gap-1.5 rounded-lg bg-secondary-fixed/50 px-2.5 py-1 text-label-md text-on-secondary-fixed-variant">
                      <Award className="size-4" />
                      {f(s.header.tierLine, { role: t.tiers.role[p.tier], letter: t.tiers.letter[p.tier] })}
                    </div>
                    {tradeNames.length > 0 && (
                      <div className="mt-space-sm flex flex-wrap gap-1.5">
                        {tradeNames.map((n) => (
                          <span key={n} className="rounded-lg bg-surface-container-low px-2.5 py-1 text-label-sm text-on-surface-variant">
                            {n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <div className="flex items-center gap-1.5">
                    {p.reviews.average !== null ? (
                      <>
                        <span className="num text-headline-md text-secondary">{p.reviews.average.toFixed(1)}</span>
                        <Stars value={p.reviews.average} size={16} label={f(s.header.ratingLabel, { avg: p.reviews.average.toFixed(1) })} />
                      </>
                    ) : (
                      <Star className="size-5 text-outline-variant" />
                    )}
                    <span className="text-label-sm text-on-surface-variant">{s.header.reviews(p.reviews.count)}</span>
                  </div>
                  <span className="text-label-sm font-semibold text-primary">{s.header.verifiedWorks(p.stats.fieldVerified)}</span>
                  <span className="text-label-sm text-on-surface-variant">
                    {s.header.years(p.yearsExperience)} · {s.header.warranty(p.warrantyMonths)}
                  </span>
                </div>
              </div>

              <div className="mt-space-md flex items-start gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-sm text-body-sm text-on-surface-variant">
                <ShieldCheck className="mt-0.5 size-[18px] shrink-0 text-primary" />
                <p>{s.header.tierNotice}</p>
              </div>

              <div className="mt-space-lg">
                <div className="mb-space-sm flex items-center gap-space-xs">
                  <Quote className="size-5 text-secondary" />
                  <h2 className="text-headline-sm text-primary">{s.header.bioTitle}</h2>
                </div>
                <p className="max-w-3xl text-body-lg text-on-surface">{p.bio || s.header.noBio}</p>
              </div>

              <div className="mt-space-md border-t border-line">
                <ProfileActions code={p.code} name={p.displayName} hasWhatsapp={p.hasWhatsapp} acceptsCalls={p.acceptsCalls} src={src} profileUrl={`${env.appUrl}/c/${p.code}`} />
              </div>
            </section>

            {/* Member card column */}
            <aside className="flex flex-col gap-space-md lg:col-span-4">
              <CardPanel
                src={src}
                data={{
                  name: p.displayName,
                  code: p.code,
                  tier: p.tier,
                  city,
                  memberSince: p.memberSince,
                  verified: p.identityVerified,
                  photoUrl: p.avatarUrl,
                  classification: tradeNames.slice(0, 2).join('، ') || null,
                }}
              />
              <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                <h2 className="mb-space-sm text-label-lg text-primary">{s.card.checksTitle}</h2>
                <ul className="space-y-2.5">
                  {checks.map((c) => (
                    <li key={c.yes} className={`flex items-start gap-space-sm text-body-sm ${c.ok ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                      <c.icon className={`mt-0.5 size-[18px] shrink-0 ${c.ok ? 'text-emerald-600' : 'text-outline'}`} />
                      {c.ok ? c.yes : c.no}
                    </li>
                  ))}
                  <li className="flex items-start gap-space-sm text-body-sm text-on-surface">
                    <CalendarCheck className="mt-0.5 size-[18px] shrink-0 text-emerald-600" />
                    {s.card.active} · {f(s.card.since, { date: fmtMonthYear(p.memberSince, locale) })}
                  </li>
                </ul>
              </div>
            </aside>
          </div>

          <div className="mt-space-lg">
            <PortfolioGallery projects={p.projects} />
            <ReviewsSection code={p.code} name={p.displayName} reviews={p.reviews} />
          </div>

          {/* Before contacting: estimate, live seal and trust */}
          <section className="mt-space-lg" aria-labelledby="lower-title">
            <div className="mb-space-md">
              <h2 id="lower-title" className="text-headline-md text-primary">
                {s.lower.title}
              </h2>
              <p className="text-body-sm text-on-surface-variant">{s.lower.subtitle}</p>
            </div>
            <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Estimator code={p.code} />
              </div>
              <div className="flex flex-col gap-space-md lg:col-span-5">
                <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                  <LiveSeal code={p.code} />
                </div>
                <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
                  <div className="flex items-center gap-space-md">
                    <TrustRing score={p.trust.score} />
                    <div>
                      <h3 className="text-headline-sm text-primary">{s.lower.trustTitle}</h3>
                      <p className="mt-1 text-body-sm text-on-surface-variant">{t.trust.explain}</p>
                    </div>
                  </div>
                  <div className="mt-space-md">
                    <TrustBreakdown parts={p.trust.parts} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
