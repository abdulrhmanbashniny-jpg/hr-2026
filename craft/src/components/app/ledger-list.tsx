import { ArrowDownLeft, ArrowUpRight, Gift, Receipt, Settings2, Sparkles, Users } from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/ar';
import { fmtNumber, fmtRelative, type Locale } from '@/lib/i18n/format';

const ICONS = {
  invoice: Receipt,
  welcome_bonus: Sparkles,
  referral_bonus: Users,
  commission_l1: Users,
  commission_l2: Users,
  redemption: Gift,
  redemption_refund: ArrowDownLeft,
  adjustment: Settings2,
} as const;

export interface LedgerRow {
  id: string;
  kind: keyof typeof ICONS;
  delta: number;
  balanceAfter: number;
  createdAt: Date | string;
  note: string | null;
}

export function LedgerList({ rows, t, locale }: { rows: LedgerRow[]; t: Dictionary; locale: Locale }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const Icon = ICONS[r.kind] ?? ArrowUpRight;
        const plus = r.delta > 0;
        return (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${plus ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'}`}>
              <Icon className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{t.ledger.kinds[r.kind]}</div>
              <div className="text-xs text-muted">{fmtRelative(r.createdAt, locale)}</div>
            </div>
            <div className="text-end">
              <div className={`num text-sm font-semibold ${plus ? 'text-success' : 'text-ink'}`}>
                {plus ? '+' : '−'}
                {fmtNumber(Math.abs(r.delta))}
              </div>
              <div className="num text-[11px] text-faint">{fmtNumber(r.balanceAfter)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
