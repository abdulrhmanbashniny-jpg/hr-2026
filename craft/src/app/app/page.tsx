import { ArrowLeft, ArrowRight, Eye, Flame, Gift, ImagePlus, MessageCircle, Phone, Calculator, ScanLine, Share2, Users } from 'lucide-react';
import Link from 'next/link';
import { AvailabilityToggle } from '@/components/app/availability-toggle';
import { LedgerList } from '@/components/app/ledger-list';
import { PushOptIn } from '@/components/app/push-optin';
import { MembershipCard } from '@/components/card/membership-card';
import { TrustBreakdown, TrustRing } from '@/components/profile/trust-ring';
import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { Progress } from '@/components/ui/controls';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { dashboard } from '@/lib/craftsmen/dashboard';
import { env } from '@/lib/env';
import { f, fmtDate, fmtNumber, getI18n } from '@/lib/i18n';

export default async function HomePage() {
  const s = await requireCraftsmanPage('/app');
  const { t, locale } = await getI18n();
  const d = await dashboard(s.craftsman.id);
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const city = locale === 'ar' ? d.city.nameAr : d.city.nameEn;
  const actions = [
    { href: '/app/invoices/scan', label: t.nav.scan, icon: ScanLine, accent: true },
    { href: '/app/portfolio/new', label: t.portfolio.add, icon: ImagePlus },
    { href: '/app/card', label: t.nav.card, icon: Share2 },
    { href: '/app/referrals', label: t.nav.referrals, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{f(t.home.greeting, { name: d.craftsman.displayName })}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.tiers[d.craftsman.tier]} · {city}
          </p>
        </div>
        <AvailabilityToggle initial={d.craftsman.availability} />
      </div>

      {d.campaign && (
        <div className="glow-border flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
          <div className="amber-gradient grid size-10 shrink-0 place-items-center rounded-xl text-accent-ink">
            <Flame className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-warning">{t.home.campaign}</div>
            <div className="text-sm font-semibold text-ink">{f(t.home.campaignBody, { name: d.campaign.name, multiplier: d.campaign.multiplier, until: fmtDate(d.campaign.endsAt, locale) })}</div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex items-center justify-center">
          <MembershipCard data={{ name: d.craftsman.displayName, code: d.craftsman.referralCode, tier: d.craftsman.tier, city, memberSince: d.craftsman.createdAt.toISOString(), verified: d.craftsman.identityStatus === 'verified' }} />
        </div>
        <div className="navy-gradient grain relative overflow-hidden rounded-3xl p-6 text-white shadow-lg">
          <div className="pattern-grid absolute inset-0 opacity-50" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/70">{t.home.balance}</span>
              <Link href="/app/rewards" className="inline-flex items-center gap-1 text-sm text-accent-2 hover:underline">
                {t.nav.rewards}
                <Arrow className="size-4" />
              </Link>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-5xl font-semibold text-white">{fmtNumber(d.balance)}</span>
              <span className="text-white/60">{t.common.points}</span>
            </div>
            <div className="tabular mt-1 text-sm text-accent-2">{f(t.home.worth, { value: fmtNumber(d.balance * d.pointValueSar, 2) })}</div>
            <div className="mt-6 rounded-2xl bg-white/[.06] p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-white/80">
                  <Gift className="size-4 text-accent-2" />
                  {t.home.nextReward}
                </span>
                {d.next && <span className="num text-xs text-white/60">{d.next.pct}%</span>}
              </div>
              {d.next ? (
                <>
                  <Progress value={d.next.pct} className="bg-white/10" />
                  <p className="mt-2 text-sm text-white/75">{f(t.home.remaining, { points: fmtNumber(d.next.remaining), reward: locale === 'ar' ? d.next.reward.titleAr : d.next.reward.titleEn })}</p>
                </>
              ) : (
                <p className="text-sm text-white/75">{t.home.allAffordable}</p>
              )}
            </div>
            <div className="mt-4 text-xs text-white/55">
              {t.home.lifetime}: <span className="num">{fmtNumber(d.lifetimeEarned)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className={`press lift flex flex-col items-start gap-3 rounded-2xl border p-4 ${a.accent ? 'amber-gradient border-transparent text-accent-ink' : 'border-line bg-surface-container-lowest text-ink'}`}>
            <a.icon className="size-6" />
            <span className="text-sm font-semibold">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={t.home.leads} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Eye, label: t.home.leadViews, value: d.leads.views },
              { icon: MessageCircle, label: t.home.leadWhatsapp, value: d.leads.whatsapp },
              { icon: Phone, label: t.home.leadCalls, value: d.leads.calls },
              { icon: Calculator, label: t.home.leadEstimates, value: d.leads.estimates },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-canvas p-3">
                <x.icon className="size-4 text-muted" />
                <div className="num mt-2 text-2xl font-semibold text-ink">{fmtNumber(x.value)}</div>
                <div className="text-xs text-muted">{x.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
            <Users className="size-4 text-accent" />
            <span className="num font-semibold">{d.activeReferrals}</span> {t.home.referralsActive}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <TrustRing score={d.trust.score} size={96} />
            <div>
              <h3 className="font-semibold">{t.trust.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t.trust.explain}</p>
            </div>
          </div>
          <div className="mt-5">
            <TrustBreakdown parts={d.trust.parts} showTips />
          </div>
        </Card>
      </div>

      <PushOptIn vapidKey={env.push.publicKey} />

      <Card>
        <CardHeader
          title={t.home.activity}
          action={
            <Link href="/app/rewards" className="text-sm text-muted hover:text-ink">
              {t.common.viewAll}
            </Link>
          }
        />
        {d.ledger.length ? <LedgerList rows={d.ledger} t={t} locale={locale} /> : <EmptyState icon={<ScanLine className="size-6" />} title={t.home.noActivity} />}
      </Card>
    </div>
  );
}
