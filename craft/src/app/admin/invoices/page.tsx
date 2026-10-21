import Link from 'next/link';
import { InvoiceQueue } from '@/components/admin/invoice-queue';
import { reviewQueue, type QueueStatus } from '@/lib/admin/invoices';
import { requireStaffPage } from '@/lib/auth/guards';
import { cn } from '@/lib/cn';
import { getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

const TABS: Record<string, QueueStatus[]> = { open: ['pending'], flagged: ['flagged'], approved: ['approved'], rejected: ['rejected'] };

export default async function InvoiceReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaffPage('invoices:review');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const tab = (await searchParams).tab ?? 'open';
  const statuses = TABS[tab] ?? TABS.open;
  const rows = await reviewQueue({ status: statuses, limit: 200 });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.invoices.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.invoices.subtitle}</p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1 scrollbar-none sm:inline-flex">
        {(Object.keys(TABS) as (keyof typeof c.invoices.tabs)[]).map((k) => (
          <Link key={k} href={`/admin/invoices?tab=${k}`} className={cn('shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium', tab === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}>
            {c.invoices.tabs[k]}
          </Link>
        ))}
      </div>
      <InvoiceQueue
        actionable={tab === 'open' || tab === 'flagged'}
        rows={rows.map(({ inv, craftsman, dealer, cityAr, cityEn }) => ({
          id: inv.id,
          status: inv.status,
          riskScore: inv.riskScore,
          reasons: inv.riskReasons,
          qrSignature: inv.qrSignature,
          qrPhase: inv.qrPhase,
          sellerName: inv.sellerName,
          sellerVat: inv.sellerVat,
          invoiceNumber: inv.invoiceNumber,
          totalAmount: inv.totalAmount,
          vatAmount: inv.vatAmount,
          declaredAmount: inv.declaredAmount,
          issuedAt: inv.issuedAt?.toISOString() ?? null,
          createdAt: inv.createdAt.toISOString(),
          pointsAwarded: inv.pointsAwarded,
          extraction: inv.extraction,
          reviewNote: inv.reviewNote,
          craftsman,
          dealer: dealer?.name ?? null,
          city: (locale === 'ar' ? cityAr : cityEn) ?? null,
        }))}
      />
    </div>
  );
}
