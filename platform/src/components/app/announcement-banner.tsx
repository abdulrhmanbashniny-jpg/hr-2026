'use client';

import { CircleAlert, Info, PartyPopper, TriangleAlert, X } from 'lucide-react';
import { useTransition } from 'react';
import { dismissAnnouncement } from '@/app/actions/announcements';
import { useI18n } from '@/lib/i18n/client';
import type { BannerVM } from '@/lib/admin/announcements';

const TONE = { info: 'blue', success: 'green', warning: 'amber', critical: 'red' } as const;
const ICON = { info: Info, success: PartyPopper, warning: TriangleAlert, critical: CircleAlert } as const;

export function AnnouncementBanners({ items }: { items: BannerVM[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <>
      {items.map((a) => {
        const Icon = ICON[a.level];
        return (
          <div key={a.id} className={`banner banner--${TONE[a.level]}`} role={a.level === 'critical' ? 'alert' : 'status'}>
            <Icon size={18} className="flex-none" />
            <div className="banner__text">
              <span className="banner__title">{a.title}</span>
              <span> — {a.body}</span>
              {a.link ? (
                <>
                  {' '}
                  <a href={a.link} target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>
                    {a.link.replace(/^https?:\/\//, '')}
                  </a>
                </>
              ) : null}
            </div>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon" style={{ width: 30, minHeight: 30, color: 'inherit' }} aria-label={t.console.messages.dismiss} disabled={pending} onClick={() => start(() => dismissAnnouncement(a.id))}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </>
  );
}
