import {
  BadgeCheck,
  Briefcase,
  CircleCheck,
  Coins,
  Flame,
  Gift,
  IdCard,
  Lock,
  MapPin,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { AvailabilityToggle } from '@/components/app/availability-toggle';
import { ShareCodeButton, WhatsAppInvite } from '@/components/app/home/share-code';
import { LedgerList } from '@/components/app/ledger-list';
import { DownloadCardButton } from '@/components/card/download-card';
import { MembershipCard, type CardData } from '@/components/card/membership-card';
import { Avatar, initials } from '@/components/ui/avatar';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { dashboard } from '@/lib/craftsmen/dashboard';
import { homeExtras } from '@/lib/craftsmen/home';
import { KSA_PATH, KSA_VIEWBOX, project } from '@/lib/geo/ksa';
import { f, fmtDate, fmtNumber, getI18n } from '@/lib/i18n';
import { appHomeStrings } from '@/lib/i18n/pages/app-home';
import { maskPhone } from '@/lib/phone';
import { mediaUrl } from '@/lib/storage';

const STATUS_TONE = {
  activated: 'bg-[rgb(16_185_129/0.1)] text-[#047857]',
  pending: 'bg-[rgb(245_158_11/0.1)] text-[#B45309]',
  held: 'bg-[rgb(245_158_11/0.1)] text-[#B45309]',
  rejected: 'bg-[rgb(239_68_68/0.1)] text-[#B91C1C]',
} as const;

export default async function HomePage() {
  const session = await requireCraftsmanPage('/app');
  const { t, locale } = await getI18n();
  const s = appHomeStrings(locale);
  const d = await dashboard(session.craftsman.id);
  const x = await homeExtras(session.craftsman.id, d.craftsman.tier, d.balance);
  const c = d.craftsman;
  const city = locale === 'ar' ? d.city.nameAr : d.city.nameEn;
  const photoUrl = mediaUrl(c.avatarKey);
  const firstName = c.displayName.split(/\s+/)[0];
  const confirmRate = x.referrals.total ? Math.round((x.referrals.confirmed / x.referrals.total) * 100) : 0;
  const card: CardData = {
    name: c.displayName,
    code: c.referralCode,
    tier: c.tier,
    city,
    memberSince: c.createdAt.toISOString(),
    verified: c.identityStatus === 'verified',
    photoUrl,
    classification: null,
  };
  const pin = project(d.city.lng, d.city.lat);
  const kpi = 'flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-shadow hover:shadow-md';
  const bucket = 'grid size-10 place-items-center rounded-xl bg-surface-container text-primary';

  return (
    <div className="flex flex-col gap-space-xl">
      {/* Welcome bar */}
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex items-start gap-space-md sm:items-center">
          <div className="relative shrink-0">
            <Avatar name={c.displayName} src={photoUrl} size={64} className="rounded-2xl shadow-sm ring-2 ring-secondary/20" />
            <span className="absolute -bottom-1 -start-1 flex size-4">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex size-4 rounded-full bg-secondary" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-space-sm">
              <h1 className="text-headline-lg-mobile tracking-tight text-primary sm:text-headline-lg">{f(s.welcome[c.tier], { name: firstName })}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 px-2.5 py-1 text-label-sm text-on-secondary-container">
                <BadgeCheck className="size-4 text-secondary" />
                {c.activatedAt ? s.activeMember : s.pendingMember}
              </span>
            </div>
            <p className="mt-1 text-body-md text-on-surface-variant">{s.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <AvailabilityToggle initial={c.availability} />
          <Link href="/app/card" className="press inline-flex h-11 items-center gap-2 rounded-xl bg-surface-container-lowest px-space-md text-label-lg text-primary shadow-sm hover:bg-surface-container-high">
            <IdCard className="size-5" />
            {s.viewCard}
          </Link>
          <ShareCodeButton code={c.referralCode} className="press amber-gradient inline-flex h-11 items-center gap-2 rounded-xl px-space-md text-label-lg text-primary-container shadow-md hover:brightness-105" />
        </div>
      </div>

      {d.campaign && (
        <div className="flex items-center gap-space-sm rounded-xl border border-secondary-fixed bg-secondary-fixed/30 p-space-md">
          <span className="amber-gradient grid size-10 shrink-0 place-items-center rounded-lg text-primary-container">
            <Flame className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-label-sm text-on-secondary-fixed-variant">{t.home.campaign}</div>
            <div className="text-label-lg text-primary">{f(t.home.campaignBody, { name: d.campaign.name, multiplier: d.campaign.multiplier, until: fmtDate(d.campaign.endsAt, locale) })}</div>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.totalReferrals}</span>
            <span className={bucket}>
              <UserPlus className="size-[22px]" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="num text-headline-xl font-bold text-primary">{fmtNumber(x.referrals.total)}</span>
            <span className="flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
              <TrendingUp className="size-3.5 text-secondary" />
              {f(s.kpi.thisMonth, { n: x.referrals.thisMonth })}
            </span>
          </div>
        </div>
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.confirmed}</span>
            <span className={bucket}>
              <CircleCheck className="size-[22px]" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="num text-headline-xl font-bold text-primary">{fmtNumber(x.referrals.confirmed)}</span>
            <span className="rounded-full bg-secondary-fixed/50 px-2 py-0.5 text-label-sm font-bold text-on-secondary-fixed-variant">{f(s.kpi.rate, { n: confirmRate })}</span>
          </div>
        </div>
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.balance}</span>
            <span className="grid size-10 place-items-center rounded-xl bg-secondary/15 text-secondary">
              <Coins className="size-[22px]" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="num text-headline-xl font-bold text-primary">{fmtNumber(d.balance)}</span>
              <span className="text-label-sm text-on-surface-variant">{s.kpi.points}</span>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-label-sm text-on-surface-variant">
                <span className="truncate">{d.next ? (locale === 'ar' ? d.next.reward.titleAr : d.next.reward.titleEn) : s.kpi.allAffordable}</span>
                {d.next && (
                  <span className="num shrink-0 font-bold text-primary">
                    {fmtNumber(d.balance)} / {fmtNumber(d.next.reward.pointsCost)}
                  </span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <div className="h-2 rounded-full bg-secondary transition-all duration-500" style={{ width: `${d.next ? d.next.pct : 100}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className={kpi}>
          <div className="flex items-center justify-between">
            <span className="text-label-md text-on-surface-variant">{s.kpi.rewards}</span>
            <span className={bucket}>
              <Gift className="size-[22px]" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <span className="text-headline-xl font-bold text-primary">
              <span className="num">{fmtNumber(x.rewardsReceived)}</span> <span className="text-headline-sm text-on-surface-variant">{s.kpi.rewardsUnit}</span>
            </span>
            <span className="flex items-center gap-0.5 text-label-sm text-secondary">
              <Sparkles className="size-4" />
              {x.rewardsInProgress ? f(s.kpi.inProgress, { n: x.rewardsInProgress }) : t.tiers.letter[c.tier]}
            </span>
          </div>
        </div>
      </div>

      {/* Bento: smart card + professional profile */}
      <div className="grid grid-cols-1 items-stretch gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg lg:col-span-7">
          <MembershipCard data={card} flippable={false} />
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
            <WhatsAppInvite code={c.referralCode} label={s.card.whatsapp} className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-whatsapp text-label-lg text-white shadow-sm hover:brightness-95" />
            <DownloadCardButton data={card} label={s.card.download} className="h-11 rounded-xl border border-line bg-surface-container-lowest text-label-lg text-primary-container shadow-xs hover:bg-canvas" />
            <Link href="/app/card" className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-container text-label-lg text-white shadow-sm hover:bg-primary">
              <UserRound className="size-[18px]" />
              {s.card.studio}
            </Link>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line pb-space-sm">
            <div className="flex items-center gap-space-xs">
              <UserRound className="size-5 text-secondary" />
              <h2 className="text-headline-sm text-primary">{s.profile.title}</h2>
            </div>
            <span className={`rounded-md px-2 py-1 text-label-sm ${c.identityStatus === 'verified' ? 'bg-secondary-fixed/50 text-on-secondary-fixed-variant' : 'bg-surface-container text-on-surface-variant'}`}>
              {c.identityStatus === 'verified' ? s.profile.official : s.profile.pending}
            </span>
          </div>
          <dl className="divide-y divide-line text-body-md">
            {[
              { icon: UserRound, label: s.profile.fullName, value: c.displayName },
              { icon: Smartphone, label: s.profile.mobile, value: x.phone ? <span className="num">{maskPhone(x.phone)}</span> : '—' },
              { icon: MapPin, label: s.profile.city, value: c.district ? `${city} · ${c.district}` : city },
              { icon: Briefcase, label: s.profile.classification, value: t.tiers.role[c.tier] },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-space-sm py-space-sm">
                <dt className="flex items-center gap-1.5 text-label-md text-on-surface-variant">
                  <row.icon className="size-4" />
                  {row.label}
                </dt>
                <dd className="truncate font-semibold text-primary">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-space-sm flex-1">
            <div className="mb-space-xs flex items-center justify-between text-label-md text-on-surface-variant">
              <span>{s.profile.location}</span>
              <span className="flex items-center gap-1 text-secondary">
                <MapPin className="size-4" />
                {city}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-primary-container p-space-sm">
              <svg viewBox={`0 0 ${KSA_VIEWBOX.width} ${KSA_VIEWBOX.height}`} className="mx-auto h-40 w-full" role="img" aria-label={city}>
                <path d={KSA_PATH} fill="rgb(255 255 255 / 0.08)" stroke="rgb(176 201 232 / 0.6)" strokeWidth={3} />
                <circle cx={pin.x} cy={pin.y} r={42} fill="rgb(251 191 36 / 0.18)" />
                <circle cx={pin.x} cy={pin.y} r={16} fill="#fbbf24" stroke="#00152a" strokeWidth={6} />
              </svg>
              <span className="code-id absolute bottom-2 start-3 text-[10px] tracking-wider text-on-primary-container">
                N {d.city.lat.toFixed(4)}° · E {d.city.lng.toFixed(4)}°
              </span>
            </div>
          </div>
          <Link href="/app/profile" className="press mt-space-md inline-flex h-10 items-center justify-center rounded-xl border border-line text-label-md text-primary-container hover:bg-canvas">
            {s.profile.edit}
          </Link>
        </div>
      </div>

      {/* Rewards preview */}
      <section>
        <div className="mb-space-md flex items-end justify-between gap-space-md">
          <div>
            <h2 className="text-headline-md text-primary">{s.rewards.title}</h2>
            <p className="text-body-sm text-on-surface-variant">{s.rewards.subtitle}</p>
          </div>
          <Link href="/app/rewards" className="shrink-0 text-label-md text-secondary hover:underline">
            {s.rewards.all}
          </Link>
        </div>
        {x.preview.length === 0 ? (
          <p className="rounded-xl bg-surface-container-lowest p-space-lg text-center text-body-md text-on-surface-variant shadow-sm">{s.rewards.empty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
            {x.preview.map((r) => {
              const ok = r.tierAllowed && r.affordable;
              return (
                <article key={r.id} className="flex flex-col rounded-2xl bg-surface-container-lowest p-space-sm shadow-sm">
                  <div className="relative overflow-hidden rounded-xl">
                    <img src={`/rewards/${r.kind}.jpg`} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover" />
                    <span className="num absolute top-2 end-2 rounded-lg bg-primary-container/90 px-2 py-1 text-label-sm text-secondary-fixed-dim">{f(s.rewards.points, { n: fmtNumber(r.pointsCost) })}</span>
                  </div>
                  <div className="flex flex-1 flex-col px-space-xs pt-space-sm">
                    <h3 className="text-headline-sm text-primary">{locale === 'ar' ? r.titleAr : r.titleEn}</h3>
                    {r.partnerName && <p className="text-body-sm text-on-surface-variant">{r.partnerName}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-space-md">
                      <span className={`flex items-center gap-1 text-label-sm ${ok ? 'text-[#047857]' : 'text-on-surface-variant'}`}>
                        {ok ? <CircleCheck className="size-4" /> : <Lock className="size-4" />}
                        {!r.tierAllowed && r.minTier ? f(s.rewards.tierLocked, { tier: t.tiers.letter[r.minTier] }) : ok ? s.rewards.available : f(s.rewards.remaining, { n: fmtNumber(r.pointsCost - d.balance) })}
                      </span>
                      {ok ? (
                        <Link href="/app/rewards" className="press rounded-lg bg-primary-container px-space-md py-1.5 text-label-md text-white hover:bg-primary">
                          {s.rewards.redeem}
                        </Link>
                      ) : (
                        <span className="rounded-lg bg-surface-container px-space-md py-1.5 text-label-md text-on-surface-variant">{s.rewards.unavailable}</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent referrals */}
      <section className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
        <div className="mb-space-md flex items-start justify-between gap-space-md">
          <div className="flex items-start gap-space-xs">
            <Users className="mt-1 size-5 text-secondary" />
            <div>
              <h2 className="text-headline-md text-primary">{s.referrals.title}</h2>
              <p className="text-body-sm text-on-surface-variant">{s.referrals.subtitle}</p>
            </div>
          </div>
          <Link href="/app/referrals" className="shrink-0 text-label-md text-secondary hover:underline">
            {s.referrals.all}
          </Link>
        </div>
        {x.referrals.recent.length === 0 ? (
          <p className="rounded-xl bg-surface-container-low p-space-lg text-center text-body-md text-on-surface-variant">{s.referrals.empty}</p>
        ) : (
          <>
            <div className="-mx-space-md overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[720px] text-start">
                <thead>
                  <tr className="bg-canvas text-label-sm text-muted">
                    {Object.values(s.referrals.cols).map((h) => (
                      <th key={h} className="px-4 py-3 text-start font-semibold first:rounded-s-xl last:rounded-e-xl">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {x.referrals.recent.map((r) => (
                    <tr key={r.id} className="h-[60px] transition-colors hover:bg-canvas">
                      <td className="px-4">
                        <span className="flex items-center gap-space-sm">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-container text-label-sm text-primary-container">{initials(r.name)}</span>
                          <span className="text-label-lg text-primary">{r.name}</span>
                        </span>
                      </td>
                      <td className="px-4 text-body-sm text-on-surface-variant">{locale === 'ar' ? r.cityAr : r.cityEn}</td>
                      <td className="px-4 text-body-sm text-on-surface-variant">{t.tiers.short[r.tier]}</td>
                      <td className="px-4 text-body-sm text-on-surface-variant">{fmtDate(r.createdAt, locale)}</td>
                      <td className="px-4">
                        <span className="code-id text-label-md text-primary">{c.referralCode}</span>
                      </td>
                      <td className="px-4">
                        <span className={`inline-flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-label-sm ${STATUS_TONE[r.status]}`}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {s.referrals.statuses[r.status]}
                        </span>
                      </td>
                      <td className="px-4 text-label-md">{r.bonus ? <span className="num text-[#047857]">{f(s.referrals.reward, { n: fmtNumber(r.bonus) })}</span> : <span className="text-muted">{s.referrals.waiting}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-space-sm text-label-sm text-muted">{f(s.referrals.shown, { n: x.referrals.recent.length, total: x.referrals.total })}</p>
          </>
        )}
      </section>

      {/* Recent activity */}
      <section className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm sm:p-space-lg">
        <h2 className="mb-space-sm text-headline-sm text-primary">{s.activity}</h2>
        <LedgerList rows={d.ledger} t={t} locale={locale} />
      </section>
    </div>
  );
}
