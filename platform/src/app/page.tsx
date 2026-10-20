import { asc, eq } from 'drizzle-orm';
import { BellRing, FileSpreadsheet, Layers, Lock, RefreshCw, Wallet } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { plans } from '@/db/schema';
import { formatSar } from '@/lib/billing/pricing';
import { f, getI18n } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const ICONS = [FileSpreadsheet, Lock, RefreshCw, Layers, BellRing, Wallet];

export default async function Landing() {
  const { t, locale } = await getI18n();
  const list = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder));
  return (
    <div className="marketing">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="font-display text-2xl font-bold" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
          {t.meta.product}
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <a href="#features" className="ui-btn ui-btn--ghost ui-btn--sm hide-sm">
            {t.landing.nav.features}
          </a>
          <a href="#pricing" className="ui-btn ui-btn--ghost ui-btn--sm hide-sm">
            {t.landing.nav.pricing}
          </a>
          <Link href="/login" className="ui-btn ui-btn--ghost ui-btn--sm">
            {t.landing.nav.login}
          </Link>
          <Link href="/register" className="ui-btn ui-btn--primary ui-btn--sm">
            {t.landing.nav.start}
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-8 lg:grid-cols-[1.15fr_.85fr]">
          <div className="flex flex-col gap-6">
            <h1 className="font-display text-4xl leading-tight font-extrabold md:text-5xl">{t.landing.heroTitle}</h1>
            <p className="max-w-xl text-lg text-ink-2" style={{ lineHeight: 1.9 }}>
              {t.landing.heroSub}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="ui-btn ui-btn--primary ui-btn--lg">
                {t.landing.heroCta}
              </Link>
              <Link href="/login" className="ui-btn ui-btn--outline ui-btn--lg">
                {t.landing.heroSecondary}
              </Link>
            </div>
          </div>
          <div className="ui-card" aria-hidden>
            <div className="ui-matrix">
              <b className="font-display">{locale === 'ar' ? 'صلاحية الإقامات' : 'Iqama validity'}</b>
              <div className="ui-matrix__bar">
                {[
                  ['expired', 4],
                  ['d30', 6],
                  ['d60', 5],
                  ['d90', 8],
                  ['valid', 35],
                ].map(([b, n]) => (
                  <div key={b} className="ui-matrix__seg" data-bucket={b} style={{ flex: n as number }} />
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                {[
                  ['expired', locale === 'ar' ? 'إقامة منتهية — سائق شاحنة ثقيلة' : 'Iqama expired — heavy truck driver'],
                  ['d30', locale === 'ar' ? 'شهادة الزكاة — باقٍ 12 يوماً' : 'Zakat certificate — 12 days left'],
                  ['d60', locale === 'ar' ? 'بطاقة تشغيل — باقٍ 40 يوماً' : 'Operating card — 40 days left'],
                ].map(([b, label]) => (
                  <span key={b} className="ui-expiry" data-bucket={b} style={{ alignSelf: 'flex-start' }}>
                    <span className="ui-expiry__dot" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {t.landing.features.map((feat, idx) => {
              const Icon = ICONS[idx] ?? FileSpreadsheet;
              return (
                <div key={feat.t} className="ui-card flex flex-col gap-2">
                  <Icon size={22} strokeWidth={1.9} />
                  <h2 className="text-lg font-bold">{feat.t}</h2>
                  <p className="text-ink-2">{feat.d}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-3xl font-bold">{t.landing.pricingTitle}</h2>
          <p className="mb-6 text-muted">{t.landing.pricingSub}</p>
          <div className="grid gap-4 md:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="ui-card flex flex-col gap-3">
                <h3 className="text-xl font-bold">{locale === 'ar' ? p.nameAr : p.nameEn}</h3>
                <p className="text-sm text-muted">{locale === 'ar' ? p.descriptionAr : p.descriptionEn}</p>
                <div>
                  <span className="ui-num text-3xl font-semibold">{formatSar(p.priceMonthly, locale)}</span>
                  <span className="text-sm text-muted"> / {t.common.perMonth}</span>
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  <li>{p.maxEmployees ? f(t.billing.employees, { n: p.maxEmployees }) : `${t.common.unlimited} — ${t.nav.residents}`}</li>
                  <li>{p.maxVehicles ? f(t.billing.vehicles, { n: p.maxVehicles }) : `${t.common.unlimited} — ${t.nav.fleet}`}</li>
                  <li>{p.maxUsers ? f(t.billing.users, { n: p.maxUsers }) : `${t.common.unlimited} — ${t.settings.tabs.members}`}</li>
                </ul>
                <Link href={`/register?plan=${p.code}`} className="ui-btn ui-btn--outline mt-auto">
                  {t.landing.heroCta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl border-t px-4 py-8 text-sm text-muted" style={{ borderColor: 'var(--line)' }}>
        {t.landing.footer}
      </footer>
    </div>
  );
}
