import { InvoiceScanner } from '@/components/app/invoice-scanner';
import { requireCraftsmanPage } from '@/lib/auth/guards';
import { getI18n } from '@/lib/i18n';

export default async function ScanPage() {
  await requireCraftsmanPage('/app/invoices/scan');
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t.invoices.scanner.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.invoices.scanner.hint}</p>
      </div>
      <InvoiceScanner />
    </div>
  );
}
