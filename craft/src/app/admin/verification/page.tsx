import { asc, eq } from 'drizzle-orm';
import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/db';
import { craftsmen, verificationDocuments } from '@/db/schema';
import { reviewDocumentAction } from '@/app/admin/actions';
import { ActionButton } from '@/components/admin/action-button';
import { EmptyState } from '@/components/ui/card';
import { requireStaffPage } from '@/lib/auth/guards';
import { fmtRelative, getI18n } from '@/lib/i18n';
import { consoleDictionary } from '@/lib/i18n/console';

export default async function VerificationPage() {
  await requireStaffPage('craftsmen:manage');
  const { locale } = await getI18n();
  const c = consoleDictionary(locale);
  const rows = await db
    .select({ d: verificationDocuments, name: craftsmen.displayName, code: craftsmen.referralCode, craftsmanId: craftsmen.id, last4: craftsmen.nationalIdLast4, license: craftsmen.licenseNumber, expires: craftsmen.licenseExpiresOn })
    .from(verificationDocuments)
    .innerJoin(craftsmen, eq(craftsmen.id, verificationDocuments.craftsmanId))
    .where(eq(verificationDocuments.status, 'pending'))
    .orderBy(asc(verificationDocuments.createdAt));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{c.verification.title}</h1>
        <p className="mt-1 text-sm text-muted">{c.verification.subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<BadgeCheck className="size-6" />} title={c.verification.empty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <div key={r.d.id} className="surface overflow-hidden">
              <a href={`/api/v1/admin/documents/${r.d.id}`} target="_blank" rel="noopener" className="block aspect-[3/2] bg-surface-2">
                {r.d.mime.startsWith('image/') ? <img src={`/api/v1/admin/documents/${r.d.id}`} alt="" className="size-full object-contain" /> : <div className="grid size-full place-items-center text-muted">PDF</div>}
              </a>
              <div className="space-y-3 p-4">
                <div>
                  <div className="text-xs font-medium text-muted">{c.verification.kinds[r.d.kind]}</div>
                  <Link href={`/admin/craftsmen/${r.craftsmanId}`} className="font-semibold text-ink hover:underline">
                    {r.name}
                  </Link>
                  <div className="num text-xs text-muted">
                    {r.code} · {r.d.kind === 'national_id' ? `••${r.last4 ?? ''}` : `${r.license ?? ''} ${r.expires ?? ''}`}
                  </div>
                  <div className="text-xs text-faint">{fmtRelative(r.d.createdAt, locale)}</div>
                </div>
                <div className="flex gap-2">
                  <ActionButton action={reviewDocumentAction.bind(null, r.d.id, true, undefined)} variant="accent">
                    {c.verification.approve}
                  </ActionButton>
                  <ActionButton action={reviewDocumentAction.bind(null, r.d.id, false, undefined)} variant="danger">
                    {c.verification.reject}
                  </ActionButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
