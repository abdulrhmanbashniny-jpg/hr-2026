import { eq } from 'drizzle-orm';
import { Download, ExternalLink, FileText, Lock } from 'lucide-react';
import type { Metadata } from 'next';
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
        <div className="auth-card">
          <Notice tone="red">{t.share.invalid}</Notice>
        </div>
      </main>
    );
  }
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, resolved.link.tenantId));
  return (
    <main className="auth-wrap">
      <div className="auth-card flex flex-col gap-4" style={{ maxWidth: 640 }}>
        <div className="text-center">
          <span className="font-display text-2xl font-bold">{t.meta.product}</span>
        </div>
        <section className="ui-card ui-card--flat">
          <div className="ui-card__head">
            <div>
              <h1 className="ui-card__title">{f(t.share.title, { company: tenant?.name ?? '' })}</h1>
              <p className="ui-card__sub">{f(t.share.expires, { date: fmtDate(resolved.link.expiresAt, locale, true) })}</p>
            </div>
            <Lock size={20} aria-hidden />
          </div>
          <ul>
            {resolved.docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 first:border-t-0" style={{ borderColor: 'var(--line-soft)' }}>
                <span className="flex items-center gap-2">
                  <FileText size={18} />
                  <span>
                    <b>{d.title}</b>
                    {d.expiryDate ? <span className="block text-xs text-muted ui-num">{d.expiryDate}</span> : null}
                  </span>
                </span>
                {d.fileKey ? (
                  <a className="ui-btn ui-btn--primary ui-btn--sm" href={`/s/${token}/${d.id}`}>
                    <Download size={16} />
                    {t.share.download}
                  </a>
                ) : d.externalUrl ? (
                  <a className="ui-btn ui-btn--ghost ui-btn--sm" href={d.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} />
                    {t.share.openLink}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <p className="text-center text-xs text-muted">{t.share.secure}</p>
      </div>
    </main>
  );
}
