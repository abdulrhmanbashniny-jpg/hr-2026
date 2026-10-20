'use client';

import { CheckCheck, Clock, MessageCircle, Phone, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { deleteContactMessage, setContactStatus } from '@/app/admin/inbox/actions';
import { Avatar } from '@/components/app/topbar';
import { Card, Empty } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/action-result';
import type { ContactCategory } from '@/lib/contact-categories';
import { useI18n } from '@/lib/i18n/client';
import { fmtDate } from '@/lib/i18n/format';

export type ContactStatus = 'new' | 'in_progress' | 'closed';

export interface ContactMessageVM {
  id: string;
  name: string;
  phone: string;
  /** International digits for wa.me, when the number could be read. */
  wa: string | null;
  category: ContactCategory;
  message: string;
  status: ContactStatus;
  createdAt: string;
  tenant: { id: string; name: string } | null;
  account: { id: string; email: string } | null;
  handledBy: string | null;
}

const CATEGORY_TONE: Record<ContactCategory, string> = { problem: 'ui-pill--red', improvement: 'ui-pill--blue', other: 'ui-pill--gray' };
const STATUS_TONE: Record<ContactStatus, string> = { new: 'ui-pill--amber', in_progress: 'ui-pill--blue', closed: 'ui-pill--green' };

function useRun() {
  const toast = useToast();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<ActionResult>) =>
      start(async () => {
        const r = await fn();
        toast(r.ok ? (r.message ?? '✓') : r.error, r.ok ? 'ok' : 'err');
      }),
  };
}

function MessageCard({ m }: { m: ContactMessageVM }) {
  const { t, locale } = useI18n();
  const c = t.console.inbox;
  const { pending, run } = useRun();
  const greeting = encodeURIComponent(`مرحباً ${m.name}، بخصوص رسالتك على منصة متابعة:\n«${m.message.slice(0, 120)}${m.message.length > 120 ? '…' : ''}»\n`);
  return (
    <article className="inbox-item" data-status={m.status}>
      <div className="inbox-item__head">
        <Avatar name={m.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <b>{m.name}</b>
            <span className={`ui-pill ${CATEGORY_TONE[m.category]}`}>{t.contact.categories[m.category]}</span>
            <span className={`ui-pill ui-pill--dot ${STATUS_TONE[m.status]}`}>{c.status[m.status]}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="ltr ui-num">{m.phone}</span>
            <span aria-hidden="true">·</span>
            {m.tenant ? <Link href={`/admin/tenants/${m.tenant.id}`}>{m.tenant.name}</Link> : <span>{c.guest}</span>}
            {m.account ? (
              <>
                <span aria-hidden="true">·</span>
                <Link href={`/admin/users/${m.account.id}`} className="ltr">
                  {m.account.email}
                </Link>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <time dateTime={m.createdAt}>{fmtDate(m.createdAt, locale, true)}</time>
            {m.handledBy && m.status !== 'new' ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{m.handledBy}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <p className="inbox-item__body">{m.message}</p>
      <div className="flex flex-wrap items-center gap-2">
        {m.wa ? (
          <a href={`https://wa.me/${m.wa}?text=${greeting}`} target="_blank" rel="noopener noreferrer" className="ui-btn ui-btn--whatsapp ui-btn--sm">
            <MessageCircle size={15} />
            {c.whatsapp}
          </a>
        ) : null}
        <a href={`tel:${m.phone}`} className="ui-btn ui-btn--outline ui-btn--sm">
          <Phone size={15} />
          {c.call}
        </a>
        <span className="ms-auto flex flex-wrap gap-1.5">
          {m.status === 'new' ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => setContactStatus(m.id, 'in_progress'))}>
              <Clock size={15} />
              {c.markProgress}
            </button>
          ) : null}
          {m.status !== 'closed' ? (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => setContactStatus(m.id, 'closed'))}>
              <CheckCheck size={15} />
              {c.markClosed}
            </button>
          ) : (
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" disabled={pending} onClick={() => run(() => setContactStatus(m.id, 'new'))}>
              <RotateCcw size={15} />
              {c.reopen}
            </button>
          )}
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" aria-label={c.delete} title={c.delete} disabled={pending} onClick={() => window.confirm(c.deleteConfirm) && run(() => deleteContactMessage(m.id))}>
            <Trash2 size={15} />
          </button>
        </span>
      </div>
    </article>
  );
}

export function InboxList({ rows }: { rows: ContactMessageVM[] }) {
  const { t } = useI18n();
  return <Card flat>{rows.length ? <div className="inbox">{rows.map((m) => <MessageCard key={m.id} m={m} />)}</div> : <Empty>{t.console.inbox.empty}</Empty>}</Card>;
}
