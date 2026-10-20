import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { DesignerCredit } from '@/components/app/credit';
import { ContactForm } from '@/components/contact/contact-form';
import { BrandTile } from '@/components/ui/brand';
import { getSession } from '@/lib/auth/session';
import { DESIGNER } from '@/lib/designer';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.contact.title, description: t.contact.sub, alternates: { canonical: '/contact' } };
}

export default async function ContactPage() {
  const { t } = await getI18n();
  const c = t.contact;
  const s = await getSession();
  return (
    <main className="contact-wrap">
      <Link href={s ? (s.tenant ? '/app' : '/admin') : '/'} className="auth-brand" aria-label={c.home}>
        <BrandTile size={48} />
        <span className="font-display text-xl font-bold">{t.meta.product}</span>
      </Link>
      <section className="ui-card contact-card flex flex-col gap-5" style={{ padding: 'var(--space-32) var(--space-24)' }}>
        <div>
          <h1 className="font-display text-2xl font-bold">{c.title}</h1>
          <p className="mt-1 text-muted">{c.sub}</p>
        </div>
        <ContactForm defaults={{ name: s?.user.name ?? '', phone: s?.user.phone ?? '' }} />
        <div className="flex flex-col gap-2 border-t pt-4" style={{ borderColor: 'var(--line-soft)' }}>
          <span className="text-sm text-muted">{c.direct}</span>
          <div className="contact-direct">
            <a href={DESIGNER.whatsappLink} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--whatsapp ui-btn--sm">
              <MessageCircle size={16} />
              {t.credit.whatsapp} <span className="ltr ui-num">{DESIGNER.whatsapp}</span>
            </a>
            <a href={DESIGNER.linkedin} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--outline ui-btn--sm">
              {t.credit.linkedin}
            </a>
          </div>
          <span className="text-xs text-muted">{t.credit.hours}</span>
        </div>
      </section>
      <DesignerCredit showContact={false} />
    </main>
  );
}
