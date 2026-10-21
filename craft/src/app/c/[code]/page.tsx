import { Award, BadgeCheck, Briefcase, CalendarCheck, Clock, IdCard, MapPin, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { after } from 'next/server';
import { Estimator } from '@/components/profile/estimator';
import { LiveSeal } from '@/components/profile/live-seal';
import { PortfolioGallery } from '@/components/profile/portfolio-gallery';
import { ProfileActions } from '@/components/profile/profile-actions';
import { TrustBreakdown, TrustRing } from '@/components/profile/trust-ring';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { TypeAnywhere } from '@/components/public/universal-search';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { parseReferralCode } from '@/lib/codes/damm';
import { leadSource } from '@/lib/craftsmen/lookup';
import { getPublicProfile } from '@/lib/craftsmen/public';
import { recordLead } from '@/lib/craftsmen/service';
import { fmtCode, fmtMonthYear, getI18n } from '@/lib/i18n';
import { requestFingerprint } from '@/lib/signals';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ src?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const parsed = parseReferralCode((await params).code);
  const p = parsed.ok ? await getPublicProfile(parsed.code) : null;
  if (!p) return { title: t.profile.notFoundTitle, robots: { index: false } };
  const city = locale === 'ar' ? p.city.nameAr : p.city.nameEn;
  return {
    title: `${p.displayName} · ${t.tiers.short[p.tier]}`,
    description: `${t.profile.verifiedBy} — ${city} · ${t.profile.memberNo} ${p.code}`,
    alternates: { canonical: `/c/${p.code}` },
  };
}

const AVAILABILITY_TONE = { available: 'success', busy: 'warning', away: 'neutral' } as const;

export default async function CraftsmanProfilePage({ params, searchParams }: Props) {
  const { t, locale } = await getI18n();
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HousePainter',
    name: p.displayName,
    identifier: p.code,
    areaServed: city,
    address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'SA' },
  };

  return (
    <>
      <SiteHeader />
      <TypeAnywhere />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <main className="pb-16">
        <div className="navy-gradient grain relative h-44 overflow-hidden sm:h-52">
          <div className="pattern-grid absolute inset-0 opacity-60" />
          <div className="absolute -end-20 -top-24 size-80 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,.35),transparent_65%)]" />
        </div>
        <div className="mx-auto -mt-24 max-w-6xl px-4 sm:-mt-28 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0 space-y-6">
              <section className="surface relative p-5 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <Avatar name={p.displayName} src={p.avatarUrl} size={96} className="-mt-14 border-4 border-surface shadow-md sm:-mt-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold sm:text-3xl">{p.displayName}</h1>
                      {p.identityVerified && <BadgeCheck className="size-6 text-accent" aria-label={t.profile.identityVerified} />}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={p.tier === 'A' ? 'accent' : p.tier === 'B' ? 'navy' : 'neutral'} icon={<Award className="size-3.5" />}>
                        {t.tiers[p.tier]}
                      </Badge>
                      <Badge tone={AVAILABILITY_TONE[p.availability]} dot>
                        {t.availability[p.availability]}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-sm text-muted">
                        <MapPin className="size-4" />
                        {city}
                      </span>
                    </div>
                    {p.trades.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.trades.map((tr) => (
                          <span key={tr.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-ink-2">
                            {locale === 'ar' ? tr.nameAr : tr.nameEn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-start sm:text-end">
                    <div className="text-xs text-muted">{t.profile.memberNo}</div>
                    <div className="num text-2xl font-semibold tracking-[0.15em] text-ink">{fmtCode(p.code)}</div>
                  </div>
                </div>
                {p.bio && <p className="mt-5 max-w-3xl leading-relaxed text-ink-2">{p.bio}</p>}
                <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { icon: <Briefcase className="size-4" />, label: t.profile.yearsExperience, value: p.yearsExperience },
                    { icon: <CalendarCheck className="size-4" />, label: t.profile.projects, value: p.stats.projects, hint: p.stats.fieldVerified ? `${p.stats.fieldVerified} ${t.profile.verifiedProjects}` : undefined },
                    { icon: <ShieldCheck className="size-4" />, label: t.profile.warranty, value: p.warrantyMonths, hint: t.profile.months },
                    { icon: <Clock className="size-4" />, label: t.profile.memberSince, value: fmtMonthYear(p.memberSince, locale), text: true },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-canvas p-3.5">
                      <dt className="flex items-center gap-1.5 text-xs text-muted">
                        {s.icon}
                        {s.label}
                      </dt>
                      <dd className={`mt-1 font-semibold text-ink ${s.text ? 'text-sm' : 'num text-xl'}`}>{s.value}</dd>
                      {s.hint && <dd className="text-[11px] text-muted">{s.hint}</dd>}
                    </div>
                  ))}
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {p.identityVerified && (
                    <Badge tone="success" icon={<IdCard className="size-3.5" />}>
                      {t.profile.identityVerified}
                    </Badge>
                  )}
                  {p.licenseVerified && (
                    <Badge tone="success" icon={<BadgeCheck className="size-3.5" />}>
                      {t.profile.licenseVerified}
                    </Badge>
                  )}
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-xl font-bold">{t.profile.portfolio}</h2>
                <PortfolioGallery projects={p.projects} />
              </section>

              <Estimator code={p.code} />
            </div>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="surface space-y-4 p-5">
                <ProfileActions code={p.code} name={p.displayName} hasWhatsapp={p.hasWhatsapp} acceptsCalls={p.acceptsCalls} src={src} />
                <LiveSeal code={p.code} />
              </div>
              <div className="surface p-5">
                <div className="flex items-center gap-4">
                  <TrustRing score={p.trust.score} />
                  <div>
                    <h2 className="font-semibold">{t.trust.title}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{t.trust.explain}</p>
                  </div>
                </div>
                <div className="mt-5">
                  <TrustBreakdown parts={p.trust.parts} />
                </div>
              </div>
              <p className="px-1 text-center text-xs text-muted">
                {t.profile.verifiedBy} · <span className="num">{p.code}</span>
              </p>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
