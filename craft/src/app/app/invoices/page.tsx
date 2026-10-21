import { CalendarDays, Receipt, ScanLine, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/card';
import { Badge, type Tone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { listInvoices } from '@/lib/invoices/queries';
import { f, fmtDate, fmtMoney, fmtNumber, getI18n } from '@/lib/i18n';

const TONE: Record<string, Tone> = { processing: 'info', pending: 'info', flagged: 'warning', approved: 'success', rejected: 'danger' };

export default async function InvoicesPage() {
  const s = await requireCraftsmanPage('/app/invoices');
  const { t, locale } = await getI18n();
  const { items } = await listInvoices(s.craftsman.id, null, 50);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.invoices.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.invoices.subtitle}</p>
        </div>
        <ButtonLink href="/app/invoices/scan" variant="accent" icon={<ScanLine className="size-5" />}>
          {t.invoices.scan}
        </ButtonLink>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Receipt className="size-6" />} title={t.invoices.empty} action={<ButtonLink href="/app/invoices/scan">{t.invoices.scan}</ButtonLink>} />
      ) : (
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${i.status === 'approved' ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'}`}>
                <Receipt className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-ink">{i.sellerName ?? '—'}</span>
                  {i.qrSignature === 'valid' && (
                    <Badge tone="success" icon={<ShieldCheck className="size-3" />}>
                      ZATCA
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {fmtDate(i.issuedAt ?? i.createdAt, locale)}
                  </span>
                  {i.totalAmount !== null && <span className="tabular">{fmtMoney(i.totalAmount, locale, 2)}</span>}
                </div>
                {i.status === 'rejected' && (i.reviewNote || i.reasons[0]) && <p className="mt-1 text-xs text-danger">{i.reviewNote ?? t.risk[i.reasons[0] as keyof typeof t.risk]}</p>}
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <Badge tone={TONE[i.status]} dot={i.status === 'processing'}>
                  {t.invoices.statuses[i.status]}
                </Badge>
                {i.pointsAwarded > 0 && <span className="tabular text-sm font-semibold text-success">{f(t.invoices.points, { points: fmtNumber(i.pointsAwarded) })}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
