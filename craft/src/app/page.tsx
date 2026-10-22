import { asc } from 'drizzle-orm';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  CircleHelp,
  CreditCard,
  Gift,
  Hash,
  IdCard,
  LayoutDashboard,
  PaintBucket,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { cities } from '@/db/schema';
import { CardShare } from '@/components/landing/card-share';
import { landingData, type RewardGroup } from '@/components/landing/data';
import { SignupCard } from '@/components/landing/signup-card';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { TypeAnywhere } from '@/components/public/universal-search';
import { getSession } from '@/lib/auth/session';
import { f, fmtNumber, getI18n } from '@/lib/i18n';
import { landingStrings } from '@/lib/i18n/pages/landing';

export const dynamic = 'force-dynamic';

const REWARD_ICON = { fuel_voucher: CreditCard, supplier_discount: PaintBucket, tool: Wrench, cash_out: Wallet, other: Gift } as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="text-label-sm font-bold text-secondary">{children}</span>;
}

function SectionHead({ eyebrow, title, body, align = 'center' }: { eyebrow: string; title: string; body: string; align?: 'center' | 'start' }) {
  return (
    <div className={align === 'center' ? 'mx-auto mb-space-xl max-w-2xl text-center' : 'mb-space-xl max-w-2xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-space-xs text-headline-xl-mobile text-primary sm:text-headline-xl">{title}</h2>
      <p className="mt-space-sm text-body-md text-on-surface-variant">{body}</p>
    </div>
  );
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { t, locale } = await getI18n();
  const s = landingStrings(locale);
  const session = await getSession().catch(() => null);
  const [data, cityRows] = await Promise.all([landingData(session?.craftsman?.referralCode ?? null), db.select().from(cities).orderBy(asc(cities.nameAr))]);
  const ref = (await searchParams).ref ?? null;
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const verifiedPct = data.members.total ? Math.round((data.members.verified / data.members.total) * 100) : 0;
  const card = data.card;
  const cardData = card
    ? {
        name: card.profile.displayName,
        code: card.profile.code,
        tier: card.profile.tier,
        city: locale === 'ar' ? card.profile.city.nameAr : card.profile.city.nameEn,
        memberSince: card.profile.memberSince,
        verified: card.profile.identityVerified,
        photoUrl: card.profile.avatarUrl,
        classification: card.profile.trades.slice(0, 2).map((x) => (locale === 'ar' ? x.nameAr : x.nameEn)).join('، ') || null,
      }
    : null;

  // Reward ladder: the referral bonus, then the most requested reward kind (highlighted), then the next one.
  const groups = [...data.rewardGroups].sort((a, b) => b.redeemed - a.redeemed || a.minCost - b.minCost);
  const highlighted: RewardGroup | undefined = groups[0];
  const third: RewardGroup | undefined = groups.find((g) => g.kind !== highlighted?.kind);
  const range = (g: RewardGroup) => (g.minValue === null ? '' : g.maxValue && g.maxValue !== g.minValue ? `${fmtNumber(g.minValue)}–${fmtNumber(g.maxValue)}` : fmtNumber(g.minValue));
  const perReferral = data.economics.referralBonus || 1;

  const steps = [UserPlus, IdCard, Send, Gift];
  const why = [Users, IdCard, Hash, Wallet];
  const flow = [Send, UserPlus, BadgeCheck, Gift];

  return (
    <>
      <SiteHeader />
      <TypeAnywhere />
      <main id="top" className="bg-surface">
        {/* ───────── Hero + sign-up ───────── */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 -end-40 size-[620px] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,.14),transparent_62%)]" />
          <div className="relative mx-auto grid max-w-[1280px] grid-cols-1 gap-space-xl px-margin-mobile pt-space-xl pb-16 lg:grid-cols-12 lg:px-margin lg:pt-16">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-space-sm py-1 text-label-sm text-on-surface-variant">
                <Sparkles className="size-3.5 text-secondary" />
                {s.hero.eyebrow}
              </span>
              <h1 className="mt-space-md text-display-hero-mobile text-primary lg:text-display-hero">{s.hero.title}</h1>
              <p className="mt-space-md max-w-xl text-body-lg text-on-surface-variant">{s.hero.body}</p>
              <div className="mt-space-lg flex flex-wrap gap-space-sm">
                <a href="#join" className="press amber-gradient inline-flex h-12 items-center gap-2 rounded-xl px-space-lg text-label-lg text-primary-container shadow-md hover:brightness-105">
                  <UserPlus className="size-5" />
                  {s.hero.ctaRegister}
                </a>
                <a href="#how" className="press inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface-container-lowest px-space-lg text-label-lg text-primary-container shadow-xs hover:bg-canvas">
                  <CircleHelp className="size-5" />
                  {s.hero.ctaHow}
                </a>
              </div>

              <div className="mt-space-xl grid grid-cols-3 gap-space-sm">
                {[
                  { value: `${fmtNumber(data.members.total)}+`, label: s.hero.members },
                  { value: `${verifiedPct}%`, label: s.hero.verified },
                  { value: s.hero.instant, label: s.hero.instantLabel },
                ].map((x) => (
                  <div key={x.label} className="rounded-xl border border-line bg-surface-container-lowest p-space-md shadow-sm">
                    <div className="num text-headline-lg-mobile text-primary sm:text-headline-lg">{x.value}</div>
                    <div className="mt-1 text-label-sm text-on-surface-variant">{x.label}</div>
                  </div>
                ))}
              </div>

              <div className="relative mt-space-lg overflow-hidden rounded-2xl shadow-lg">
                <img src="/images/hero-painter.webp" alt={s.hero.photoAlt} width={1200} height={896} className="aspect-[16/10] w-full object-cover" fetchPriority="high" />
                {card && (
                  <Link href={`/c/${card.profile.code}`} className="absolute bottom-space-md start-space-md flex items-center gap-space-sm rounded-xl bg-surface-container-lowest/95 p-space-sm pe-space-md shadow-md backdrop-blur">
                    <span className="grid size-10 place-items-center rounded-lg bg-secondary-fixed/60 text-secondary">
                      <BadgeCheck className="size-5" />
                    </span>
                    <span className="leading-tight">
                      <span className="block text-label-md font-semibold text-primary">{card.profile.displayName}</span>
                      <span className="block text-label-sm text-on-surface-variant">
                        {s.hero.badgeTitle} · {t.tiers.letter[card.profile.tier]}
                      </span>
                    </span>
                  </Link>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 lg:pt-space-md">
              <div className="lg:sticky lg:top-28">
                <SignupCard cities={cityRows.map((c) => ({ id: c.id, name: locale === 'ar' ? c.nameAr : c.nameEn }))} welcomeBonus={data.economics.welcomeBonus} initialRef={ref} />
              </div>
            </div>
          </div>
        </section>

        {/* ───────── Smart card ───────── */}
        {cardData && card && (
          <section className="border-y border-line bg-surface-container-lowest py-16">
            <div className="mx-auto max-w-[1280px] px-margin-mobile lg:px-margin">
              <SectionHead eyebrow={s.card.eyebrow} title={s.card.title} body={s.card.body} />
              <CardShare data={cardData} joined={card.joined} active={card.active} earned={card.earned} own={card.own} />
            </div>
          </section>
        )}

        {/* ───────── How it works ───────── */}
        <section id="how" className="scroll-mt-24 py-16">
          <div className="mx-auto max-w-[1280px] px-margin-mobile lg:px-margin">
            <SectionHead eyebrow={s.how.eyebrow} title={s.how.title} body={s.how.body} />
            <ol className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
              {s.how.steps.map((step, i) => {
                const Icon = steps[i];
                return (
                  <li key={step.title} className="lift flex flex-col rounded-2xl border border-line bg-surface-container-lowest p-space-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className={`num grid size-11 place-items-center rounded-xl text-label-lg ${i === 3 ? 'bg-primary-container text-secondary-fixed-dim' : 'bg-secondary-fixed/50 text-on-secondary-fixed'}`}>{String(i + 1).padStart(2, '0')}</span>
                      <Icon className="size-6 text-secondary" />
                    </div>
                    <h3 className="mt-space-md text-headline-sm text-primary">{step.title}</h3>
                    <p className="mt-space-xs flex-1 text-body-sm text-on-surface-variant">{step.body}</p>
                    <div className="mt-space-md flex items-center gap-1 text-label-md text-secondary">
                      <Arrow className="size-4" />
                      {step.foot}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ───────── Why join ───────── */}
        <section id="about" className="scroll-mt-24 border-y border-line bg-surface-container-low py-16">
          <div className="mx-auto max-w-[1280px] px-margin-mobile lg:px-margin">
            <div className="mb-space-xl flex flex-col justify-between gap-space-md md:flex-row md:items-end">
              <div className="max-w-2xl">
                <Eyebrow>{s.why.eyebrow}</Eyebrow>
                <h2 className="mt-space-xs text-headline-xl-mobile text-primary sm:text-headline-xl">{s.why.title}</h2>
                <p className="mt-space-sm text-body-md text-on-surface-variant">{s.why.body}</p>
              </div>
              <a href="#join" className="press inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-line bg-surface-container-lowest px-space-md text-label-lg text-primary-container shadow-xs hover:bg-canvas md:self-auto">
                <Arrow className="size-4" />
                {s.why.cta}
              </a>
            </div>
            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
              {s.why.items.map((item, i) => {
                const Icon = why[i];
                const tint = ['bg-primary-fixed text-on-primary-fixed-variant', 'bg-secondary-fixed/60 text-on-secondary-fixed-variant', 'bg-surface-container-high text-primary-container', 'bg-primary-container text-secondary-fixed-dim'][i];
                return (
                  <div key={item.title} className="lift rounded-2xl border border-line bg-surface-container-lowest p-space-lg shadow-sm">
                    <span className={`grid size-12 place-items-center rounded-xl ${tint}`}>
                      <Icon className="size-6" />
                    </span>
                    <h3 className="mt-space-md text-headline-sm text-primary">{item.title}</h3>
                    <p className="mt-space-xs text-body-sm text-on-surface-variant">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────── Rewards ───────── */}
        <section id="rewards" className="scroll-mt-24 py-16">
          <div className="mx-auto max-w-[1280px] px-margin-mobile lg:px-margin">
            <SectionHead eyebrow={s.rewards.eyebrow} title={s.rewards.title} body={s.rewards.body} />
            <ol className="grid grid-cols-2 gap-space-sm rounded-2xl border border-line bg-surface-container-lowest p-space-md shadow-sm lg:grid-cols-4">
              {s.rewards.flow.map((x, i) => {
                const Icon = flow[i];
                return (
                  <li key={x.title} className="flex flex-col items-center gap-space-xs p-space-sm text-center">
                    <span className={`grid size-12 place-items-center rounded-full ${i === 3 ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-surface-container text-primary-container'}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="text-label-lg text-primary">{x.title}</span>
                    <span className="text-body-sm text-on-surface-variant">{x.body}</span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-space-lg grid grid-cols-1 gap-space-md lg:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface-container-lowest p-space-lg shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">{s.rewards.basicBadge}</span>
                  <Star className="size-5 text-secondary" />
                </div>
                <div className="mt-space-md text-headline-lg text-primary">
                  <span className="num">{f(s.rewards.points, { n: fmtNumber(data.economics.referralBonus) })}</span>
                </div>
                <p className="mt-space-xs text-body-sm text-on-surface-variant">{f(s.rewards.basicBody, { l1: data.economics.commissionL1Pct, l2: data.economics.commissionL2Pct })}</p>
                <div className="mt-space-md flex items-center gap-1.5 text-label-md text-[#047857]">
                  <CircleCheck className="size-4" />
                  {s.rewards.basicFoot}
                </div>
              </div>

              {highlighted && (
                <div className="vip-surface relative overflow-hidden rounded-2xl p-space-lg text-white lg:-my-space-sm">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-secondary-container px-2.5 py-1 text-label-sm text-on-secondary-fixed">{s.rewards.mostRequested}</span>
                    {(() => {
                      const Icon = REWARD_ICON[highlighted.kind];
                      return <Icon className="size-6 text-secondary-fixed-dim" />;
                    })()}
                  </div>
                  <h3 className="mt-space-md text-headline-md">{s.rewards.kinds[highlighted.kind].title}</h3>
                  <p className="mt-space-xs text-body-sm text-on-primary-container">{f(s.rewards.kinds[highlighted.kind].body, { range: range(highlighted) })}</p>
                  <div className="mt-space-md flex items-center gap-1.5 text-label-md text-secondary-fixed-dim">
                    <Sparkles className="size-4" />
                    {s.rewards.afterReferrals(Math.max(1, Math.ceil(highlighted.minCost / perReferral)))}
                  </div>
                  <div className="mt-space-xs text-label-sm text-on-primary-container">{f(s.rewards.redeemFoot, { n: fmtNumber(highlighted.minCost) })}</div>
                </div>
              )}

              {third && (
                <div className="rounded-2xl border border-line bg-surface-container-lowest p-space-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-secondary-fixed/50 px-2.5 py-1 text-label-sm text-on-secondary-fixed-variant">{s.rewards.highlighted}</span>
                    {(() => {
                      const Icon = REWARD_ICON[third.kind];
                      return <Icon className="size-5 text-secondary" />;
                    })()}
                  </div>
                  <h3 className="mt-space-md text-headline-md text-primary">{s.rewards.kinds[third.kind].title}</h3>
                  <p className="mt-space-xs text-body-sm text-on-surface-variant">{f(s.rewards.kinds[third.kind].body, { range: range(third) })}</p>
                  <div className="mt-space-md text-label-md text-on-surface-variant">{f(s.rewards.fromPoints, { n: fmtNumber(third.minCost) })}</div>
                </div>
              )}
            </div>
            {data.rewardCount > 0 && (
              <div className="mt-space-lg flex flex-col items-center gap-space-sm text-center">
                <span className="text-body-md text-on-surface-variant">{s.rewards.catalogue(data.rewardCount)}</span>
                <Link href="/app/rewards" className="press inline-flex h-11 items-center gap-2 rounded-xl bg-primary-container px-space-lg text-label-lg text-white shadow-sm hover:bg-primary">
                  <Gift className="size-5" />
                  {s.rewards.browse}
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ───────── Factory products ───────── */}
        {data.products.length > 0 && (
          <section id="products" className="scroll-mt-24 border-y border-line bg-surface-container-lowest py-16">
            <div className="mx-auto max-w-[1280px] px-margin-mobile lg:px-margin">
              <SectionHead eyebrow={s.products.eyebrow} title={s.products.title} body={s.products.body} />
              <div className="grid grid-cols-2 gap-space-sm sm:gap-space-md lg:grid-cols-4">
                {data.products.map((p) => (
                  <article key={p.id} className="lift flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-container-lowest shadow-sm">
                    <div className="relative aspect-square bg-surface-container-low">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={locale === 'ar' ? p.nameAr : p.nameEn} loading="lazy" className="size-full object-cover" />
                      ) : (
                        <div className="grid size-full place-items-center" style={{ background: p.swatch }}>
                          <PaintBucket className="size-12 text-primary-container/50" />
                        </div>
                      )}
                      <span className="absolute top-space-sm start-space-sm rounded-md bg-surface-container-lowest/90 px-2 py-1 text-label-sm text-primary-container backdrop-blur">{s.products.categories[p.category]}</span>
                      {p.isFeatured && <span className="absolute top-space-sm end-space-sm rounded-md bg-secondary-container px-2 py-1 text-label-sm text-on-secondary-fixed">{s.products.featured}</span>}
                    </div>
                    <div className="flex flex-1 flex-col p-space-md">
                      <div className="flex items-center gap-2">
                        <span className="size-4 shrink-0 rounded-full border border-line" style={{ background: p.swatch }} />
                        <h3 className="text-label-lg text-primary sm:text-headline-sm">{locale === 'ar' ? p.nameAr : p.nameEn}</h3>
                      </div>
                      <p className="mt-space-xs line-clamp-3 flex-1 text-body-sm text-on-surface-variant max-sm:hidden">{locale === 'ar' ? p.descriptionAr : p.descriptionEn}</p>
                      <dl className="mt-space-md grid grid-cols-3 gap-1 border-t border-line pt-space-sm text-center max-sm:hidden">
                        <div>
                          <dt className="text-label-sm text-muted">{s.products.finishLabel}</dt>
                          <dd className="text-label-md text-primary">{(locale === 'ar' ? p.finishAr : p.finishEn) ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-label-sm text-muted">{s.products.coverageLabel}</dt>
                          <dd className="text-label-md text-primary">{p.coverageSqmPerLiter ? f(s.products.coverage, { n: p.coverageSqmPerLiter }) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-label-sm text-muted">{s.products.sizesLabel}</dt>
                          <dd className="num text-label-md text-primary">{p.sizes.join(' · ') || '—'}</dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ───────── Call to action band ───────── */}
        <section className="py-16">
          <div className="mx-auto max-w-[1280px] px-margin-mobile lg:px-margin">
            <div className="vip-surface relative overflow-hidden rounded-2xl px-space-lg py-space-xl text-white sm:px-space-xl">
              <div className="flex flex-col justify-between gap-space-lg lg:flex-row lg:items-center">
                <div className="max-w-2xl">
                  <span className="inline-flex items-center gap-1.5 text-label-sm font-bold text-secondary-fixed-dim">
                    <Sparkles className="size-4" />
                    {s.band.eyebrow}
                  </span>
                  <h2 className="mt-space-xs text-headline-lg-mobile sm:text-headline-lg">{s.band.title}</h2>
                  <p className="mt-space-xs text-body-md text-on-primary-container">{s.band.body}</p>
                </div>
                <div className="flex flex-wrap gap-space-sm">
                  <a href="#join" className="press amber-gradient inline-flex h-12 items-center gap-2 rounded-xl px-space-lg text-label-lg text-primary-container shadow-md hover:brightness-105">
                    <UserPlus className="size-5" />
                    {s.header.cta}
                  </a>
                  <Link href="/app" className="press inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-space-md text-label-lg text-white hover:bg-white/15">
                    <IdCard className="size-5" />
                    {s.header.craftsmanPortal}
                  </Link>
                  <Link href="/admin" className="press inline-flex h-12 items-center gap-2 rounded-xl bg-white/10 px-space-md text-label-lg text-white hover:bg-white/15">
                    <LayoutDashboard className="size-5" />
                    {s.header.adminPortal}
                  </Link>
                </div>
              </div>
            </div>
            <p className="mt-space-md flex items-center justify-center gap-1.5 text-center text-body-sm text-muted">
              <ShieldCheck className="size-4" />
              {s.signup.secure}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
