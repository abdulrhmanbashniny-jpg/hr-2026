import Link from 'next/link';
import type { Matrix } from '@/lib/analytics/common';
import type { Dictionary } from '@/lib/i18n/ar';
import { fmtNumber } from '@/lib/i18n/format';

const ORDER = ['expired', 'd30', 'd60', 'd90', 'valid'] as const;

/** Stacked five-bucket bar with a counted legend. Legend items link to a filtered table when `hrefFor` is given. */
export function ExpiryMatrix({ title, matrix, t, hrefFor, active, total }: { title: string; matrix: Matrix; t: Dictionary; hrefFor?: (bucket: string) => string; active?: string | null; total?: number }) {
  const sum = ORDER.reduce((s, b) => s + matrix[b], 0);
  const aria = ORDER.map((b) => `${t.expiry[b]}: ${matrix[b]}`).join('، ');
  return (
    <div className="ui-card" style={{ padding: 18 }}>
      <div className="ui-matrix">
        <div className="flex items-center justify-between gap-2">
          <h3 className="ui-card__title">{title}</h3>
          <span className="ui-hint ui-num">{fmtNumber(total ?? sum + matrix.none)}</span>
        </div>
        <div className="ui-matrix__bar" role="img" aria-label={aria}>
          {sum === 0 ? null : ORDER.filter((b) => matrix[b] > 0).map((b) => <div key={b} className="ui-matrix__seg" data-bucket={b} style={{ flex: matrix[b] }} />)}
        </div>
        <div className="ui-matrix__legend">
          {ORDER.map((b) => {
            const inner = (
              <>
                <span className="ui-matrix__count">{fmtNumber(matrix[b])}</span>
                <span className="ui-matrix__name">
                  <span className="ui-expiry" data-bucket={b} style={{ padding: 0, background: 'none' }}>
                    <span className="ui-expiry__dot" />
                  </span>
                  <span title={t.expiry[b]}>
                    {t.expiry.short[b]}
                  </span>
                </span>
              </>
            );
            return hrefFor ? (
              <Link key={b} href={hrefFor(b)} className="ui-matrix__item" aria-pressed={active === b} aria-label={`${t.expiry[b]}: ${matrix[b]}`} style={{ textDecoration: 'none' }}>
                {inner}
              </Link>
            ) : (
              <div key={b} className="ui-matrix__item" style={{ cursor: 'default' }}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
