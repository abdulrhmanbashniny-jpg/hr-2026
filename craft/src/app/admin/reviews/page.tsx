import { CircleCheck, MessageSquareQuote, X } from 'lucide-react';
import Link from 'next/link';
import { moderateReviewAction } from '@/app/admin/actions';
import { ActionButton } from '@/components/admin/action-button';
import { Stars } from '@/components/profile/stars';
import { EmptyState, PageHeader } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { f, fmtRelative, getI18n } from '@/lib/i18n';
import { adminStrings } from '@/lib/i18n/pages/admin';
import { moderationQueue } from '@/lib/reviews/service';

export const dynamic = 'force-dynamic';

const TABS = ['pending', 'approved', 'rejected'] as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaffPage('reviews:moderate');
  const { locale } = await getI18n();
  const s = adminStrings(locale).reviews;
  const tab = (TABS as readonly string[]).includes((await searchParams).tab ?? '') ? ((await searchParams).tab as (typeof TABS)[number]) : 'pending';
  const rows = await moderationQueue(tab);
  return (
    <div>
      <PageHeader title={s.title} subtitle={s.subtitle} />
      <div className="mb-space-md flex flex-wrap gap-1 rounded-xl bg-surface-container-low p-1 text-label-md">
        {TABS.map((k) => (
          <Link key={k} href={`/admin/reviews?tab=${k}`} className={`rounded-lg px-space-md py-1.5 ${k === tab ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}>
            {s.tabs[k]}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<MessageSquareQuote />} title={s.empty} />
      ) : (
        <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2">
          {rows.map((r) => (
            <article key={r.id} className="flex flex-col rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
              <div className="flex items-start justify-between gap-space-sm">
                <div>
                  <div className="text-label-lg text-primary">{r.authorName}</div>
                  <Link href={`/admin/craftsmen/${r.craftsmanId}`} className="text-body-sm text-secondary hover:underline">
                    {r.craftsmanName} · <span className="num">{r.code}</span>
                  </Link>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Stars value={r.rating} size={14} />
                  <span className="text-label-sm text-muted">{fmtRelative(r.createdAt, locale)}</span>
                </div>
              </div>
              <p className="mt-space-sm flex-1 text-body-md text-on-surface">“{r.body}”</p>
              <div className="mt-space-sm flex flex-wrap items-center gap-space-sm text-label-sm">
                {r.projectLabel && <span className="rounded-md bg-surface-container px-2 py-1 text-on-surface-variant">{f(s.project, { label: r.projectLabel })}</span>}
                <span className={`rounded-md px-2 py-1 ${r.contacted ? 'bg-[rgb(16_185_129/0.1)] text-[#047857]' : 'bg-surface-container text-on-surface-variant'}`}>{r.contacted ? s.contacted : s.notContacted}</span>
              </div>
              {tab === 'pending' && (
                <div className="mt-space-md flex gap-space-sm border-t border-line pt-space-sm">
                  <ActionButton action={moderateReviewAction.bind(null, r.id, true)} variant="primary" icon={<CircleCheck className="size-4" />}>
                    {s.approve}
                  </ActionButton>
                  <ActionButton action={moderateReviewAction.bind(null, r.id, false)} variant="danger" icon={<X className="size-4" />}>
                    {s.reject}
                  </ActionButton>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
