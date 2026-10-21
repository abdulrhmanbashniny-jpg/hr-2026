import { SearchX } from 'lucide-react';
import { SiteFooter } from '@/components/public/site-footer';
import { SiteHeader } from '@/components/public/site-header';
import { UniversalSearch } from '@/components/public/universal-search';
import { getI18n } from '@/lib/i18n';

export default async function CraftsmanNotFound() {
  const { t } = await getI18n();
  return (
    <>
      <SiteHeader search={false} />
      <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
          <SearchX className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">{t.profile.notFoundTitle}</h1>
        <p className="text-muted">{t.profile.notFoundBody}</p>
        <div className="mt-4 w-full">
          <UniversalSearch autoFocus />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
