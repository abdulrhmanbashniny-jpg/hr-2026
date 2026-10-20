import Link from 'next/link';
import { DesignerCredit } from '@/components/app/credit';
import { BrandTile } from '@/components/ui/brand';
import { getSession } from '@/lib/auth/session';
import { fmtDate, getI18n } from '@/lib/i18n';
import { APP_VERSION, RELEASES } from '@/lib/releases';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.changelog.title, description: t.changelog.sub };
}

export default async function ChangelogPage() {
  const { t, locale } = await getI18n();
  const c = t.changelog;
  const s = await getSession();
  return (
    <main className="contact-wrap">
      <Link href={s ? (s.tenant ? '/app' : '/admin') : '/'} className="auth-brand" aria-label={c.home}>
        <BrandTile size={48} />
        <span className="font-display text-xl font-bold">{t.meta.product}</span>
      </Link>
      <section className="ui-card contact-card flex flex-col gap-5" style={{ padding: 'var(--space-32) var(--space-24)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">{c.title}</h1>
            <p className="mt-1 text-muted">{c.sub}</p>
          </div>
          <span className="ui-pill ui-pill--blue">
            {c.current} · <span className="ui-num">{APP_VERSION}</span>
          </span>
        </div>
        <p className="ui-hint">{c.rule}</p>
        <div>
          {RELEASES.map((r) => (
            <article key={r.version} className="release" id={`v${r.version}`}>
              <div className="release__head">
                <span className="release__version">{r.version}</span>
                <span className={`ui-pill ${r.kind === 'major' ? 'ui-pill--purple' : 'ui-pill--gray'}`}>{r.kind === 'major' ? c.major : c.minor}</span>
                <time dateTime={r.date} className="text-xs text-muted">
                  {fmtDate(r.date, locale)}
                </time>
              </div>
              <ul className="release__list">
                {(locale === 'ar' ? r.ar : r.en).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <DesignerCredit />
    </main>
  );
}
