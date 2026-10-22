import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CircleCheck, Fingerprint, Gift, HardHat, MapPin, QrCode, Receipt, ScanLine, ShieldCheck, Sparkles, Timer, UserRound } from 'lucide-react';
import Link from 'next/link';
import { MembershipCard } from '@/components/card/membership-card';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { TypeAnywhere, UniversalSearch } from '@/components/public/universal-search';
import { Avatar } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button';
import { featuredCraftsmen, landingStats } from '@/lib/craftsmen/featured';
import { fmtCompact, getI18n } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const { t, locale } = await getI18n();
  const [stats, featured] = await Promise.all([landingStats().catch(() => null), featuredCraftsmen().catch(() => [])]);
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const demo = featured[0];
  const audiences = [
    { key: 'craftsmen', icon: <HardHat className="size-5" />, data: t.landing.audiences.craftsmen },
    { key: 'brands', icon: <Building2 className="size-5" />, data: t.landing.audiences.brands },
    { key: 'clients', icon: <UserRound className="size-5" />, data: t.landing.audiences.clients },
  ];
  const stepIcons = [<Fingerprint key="1" className="size-5" />, <Sparkles key="2" className="size-5" />, <ScanLine key="3" className="size-5" />, <Gift key="4" className="size-5" />];
  const trustIcons = [<Receipt key="1" className="size-5" />, <Timer key="2" className="size-5" />, <ShieldCheck key="3" className="size-5" />];

  return (
    <>
      <SiteHeader search={false} />
      <TypeAnywhere />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 start-1/2 size-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,.16),transparent_60%)] rtl:translate-x-1/2" />
            <div className="absolute -bottom-40 -start-40 size-[560px] rounded-full bg-[radial-gradient(circle,rgba(16,42,67,.12),transparent_60%)]" />
          </div>
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-container-lowest px-3 py-1 text-xs font-medium text-ink-2 shadow-sm">
                <span className="size-1.5 rounded-full bg-accent" />
                {t.landing.eyebrow}
              </span>
              <h1 className="mt-5 text-4xl leading-[1.15] font-bold sm:text-5xl lg:text-[56px]">{t.landing.title}</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t.landing.subtitle}</p>
              <div className="mt-8 max-w-xl" id="verify">
                <UniversalSearch size="lg" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ButtonLink href="/login?join=1" variant="primary" size="lg" icon={<QrCode className="size-5" />}>
                  {t.landing.ctaJoin}
                </ButtonLink>
                <span className="text-sm text-muted">{t.search.shortcut} ⌨</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-x-10 top-10 bottom-0 rounded-[40px] bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,.25),transparent_65%)] blur-2xl" aria-hidden />
              <MembershipCard
                data={{ name: demo?.name ?? 'أبو فهد للدهانات', code: demo?.code ?? '839210', tier: demo?.tier ?? 'A', city: demo ? (locale === 'ar' ? demo.cityAr : demo.cityEn) : 'الرياض', memberSince: (demo?.memberSince ?? new Date()).toString(), verified: true }}
              />
              <div className="glass absolute -bottom-2 start-2 hidden items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm shadow-md sm:flex">
                <CircleCheck className="size-5 text-success" />
                <span className="text-ink">ZATCA QR</span>
                <span className="num font-semibold text-accent">+1,250</span>
              </div>
            </div>
          </div>
          {stats && (
            <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
              <dl className="surface grid grid-cols-2 divide-line overflow-hidden p-0 sm:grid-cols-4 sm:divide-x rtl:sm:divide-x-reverse">
                {(
                  [
                    ['craftsmen', stats.craftsmen],
                    ['cities', stats.cities],
                    ['invoices', stats.invoices],
                    ['points', stats.points],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="p-5 text-center">
                    <dt className="text-sm text-muted">{t.landing.stats[k]}</dt>
                    <dd className="num mt-1 text-3xl font-semibold text-ink">{fmtCompact(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>

        {/* Audiences */}
        <section id="audiences" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold">{t.landing.audiences.title}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map((a, i) => (
              <div key={a.key} className={`surface lift p-6 ${i === 0 ? 'glow-border' : ''}`}>
                <div className={`grid size-11 place-items-center rounded-xl ${i === 0 ? 'amber-gradient text-accent-ink' : 'bg-navy-900 text-white'}`}>{a.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{a.data.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {a.data.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-ink-2">
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-surface-container-lowest py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold">{t.landing.how.title}</h2>
            <ol className="mt-10 grid gap-5 md:grid-cols-4">
              {t.landing.how.steps.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-line bg-canvas p-5">
                  <div className="flex items-center gap-3">
                    <span className="num grid size-9 place-items-center rounded-full bg-navy-900 text-sm font-semibold text-white">{i + 1}</span>
                    <span className="text-accent">{stepIcons[i]}</span>
                  </div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section id="trust" className="navy-gradient grain relative scroll-mt-20 overflow-hidden py-20 text-white">
          <div className="pattern-grid absolute inset-0 opacity-50" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-2xl text-3xl font-bold text-white">{t.landing.trust.title}</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {t.landing.trust.items.map((it, i) => (
                <div key={it.title} className="rounded-2xl border border-white/10 bg-white/[.04] p-6 backdrop-blur">
                  <div className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent-2">{trustIcons[i]}</div>
                  <h3 className="mt-4 font-semibold text-white">{it.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured */}
        {featured.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-bold">{t.landing.featured}</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c) => (
                <Link key={c.code} href={`/c/${c.code}?src=link`} className="surface lift group flex items-center gap-4 p-4">
                  <Avatar name={c.name} size={56} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                      <span className="truncate">{c.name}</span>
                      {c.identity === 'verified' && <BadgeCheck className="size-4 shrink-0 text-accent" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                      <MapPin className="size-3.5" />
                      {locale === 'ar' ? c.cityAr : c.cityEn} · {t.tiers.short[c.tier]}
                    </div>
                    <div className="num mt-1 text-xs tracking-[0.15em] text-faint">{c.code}</div>
                  </div>
                  <Arrow className="size-5 text-faint transition group-hover:text-accent" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="glow-border surface flex flex-col items-start gap-6 overflow-hidden p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{t.landing.ctaTitle}</h2>
              <p className="mt-2 text-muted">{t.landing.ctaBody}</p>
            </div>
            <ButtonLink href="/login?join=1" variant="accent" size="lg">
              {t.landing.ctaJoin}
              <Arrow className="size-5" />
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
