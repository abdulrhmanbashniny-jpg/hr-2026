import { eq } from 'drizzle-orm';
import { Download, ExternalLink, FileText, Lock } from 'lucide-react';
import type { Metadata } from 'next';
import { ShareCountdown } from '@/components/share/countdown';
import { BrandTile } from '@/components/ui/brand';
import { Notice } from '@/components/ui/card';
import { db } from '@/db';
import { tenants } from '@/db/schema';
import { resolveShareToken } from '@/lib/documents/share';
import { f, fmtDate, getI18n } from '@/lib/i18n';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharePage(props: PageProps<'/s/[token]'>) {
  const { t, locale } = await getI18n();
  const { token } = await props.params;
  const resolved = await resolveShareToken(token);
  if (!resolved) {
    return (
      <main className="auth-wrap">
        <div className="auth-card flex flex-col items-center gap-4">
          <BrandTile size={52} />
          <Notice tone="red">{t.share.invalid}</Notice>
        </div>
      </main>
    );
  }
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, resolved.link.tenantId));
  const expiresAt = resolved.link.expiresAt?.toISOString() ?? null;
  return (
    <main className="auth-wrap">
      <div className="auth-card flex flex-col gap-4" style={{ maxWidth: 640 }}>
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandTile size={52} />
          <h1 className="font-display text-2xl font-bold">{f(t.share.title, { company: tenant?.name ?? '' })}</h1>
          {expiresAt ? <p className="text-sm text-muted">{f(t.share.expires, { date: fmtDate(expiresAt, locale, true) })}</p> : null}
        </div>
        <ShareCountdown expiresAt={expiresAt} />
        <section className="ui-card ui-card--flat">
          <div className="ui-card__head">
            <h2 className="ui-card__title">
              {t.share.files} · <span className="ui-num">{resolved.docs.length}</span>
            </h2>
            <Lock size={18} aria-hidden style={{ color: 'var(--muted)' }} />
          </div>
          <div className="list">
            {resolved.docs.map((d) => (
              <div key={d.id} className="list__row">
                <span className="ui-kpi__icon" style={{ ['--tile' as string]: 'var(--accent)' }}>
                  <FileText size={17} />
                </span>
                <div className="list__main">
                  <div className="list__title">{d.title}</div>
                  {d.expiryDate ? <div className="list__sub ui-num">{d.expiryDate}</div> : null}
                </div>
                {d.fileKey ? (
                  <a className="ui-btn ui-btn--primary ui-btn--sm" href={`/s/${token}/${d.id}`}>
                    <Download size={16} />
                    {t.share.download}
                  </a>
                ) : d.externalUrl ? (
                  <a className="ui-btn ui-btn--outline ui-btn--sm" href={d.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} />
                    {t.share.openLink}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
        <p className="text-center text-xs text-muted">{t.share.secure}</p>
      </div>
    </main>
  );
}
