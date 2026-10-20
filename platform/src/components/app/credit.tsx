'use client';

import { MessageCircle, MessageSquareText } from 'lucide-react';
import Link from 'next/link';
import { DESIGNER } from '@/lib/designer';
import { useI18n } from '@/lib/i18n/client';

function LinkedInGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4v11H3v-11Zm6.5 0h3.83v1.5h.05c.53-.95 1.84-1.95 3.79-1.95 4.05 0 4.8 2.5 4.8 5.76v5.69h-4v-5.04c0-1.2-.02-2.75-1.75-2.75-1.75 0-2.02 1.31-2.02 2.66v5.13h-4v-11Z" />
    </svg>
  );
}

/** The designer's credit and contact line shown at the bottom of every page. */
export function DesignerCredit({ showContact = true }: { showContact?: boolean }) {
  const { t } = useI18n();
  const c = t.credit;
  return (
    <footer className="credit">
      <span>
        {c.designedBy} <b className="credit__name">{c.name}</b>
      </span>
      <span className="credit__sep" aria-hidden="true">
        ·
      </span>
      <a href={DESIGNER.whatsappLink} target="_blank" rel="noopener noreferrer" className="credit__link">
        <MessageCircle size={14} aria-hidden="true" />
        {c.whatsapp} <span className="ltr ui-num">{DESIGNER.whatsapp}</span>
      </a>
      <span className="credit__muted">({c.hours})</span>
      <span className="credit__sep" aria-hidden="true">
        ·
      </span>
      <a href={DESIGNER.linkedin} target="_blank" rel="noopener noreferrer" className="credit__link">
        <LinkedInGlyph />
        {c.linkedin}
      </a>
      {showContact ? (
        <>
          <span className="credit__sep" aria-hidden="true">
            ·
          </span>
          <Link href="/contact" className="credit__link">
            <MessageSquareText size={14} aria-hidden="true" />
            {c.contact}
          </Link>
        </>
      ) : null}
    </footer>
  );
}
