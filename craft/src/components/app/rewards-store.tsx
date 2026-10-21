'use client';

import { Banknote, Copy, Fuel, Gift, Lock, Percent, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confetti } from '@/components/ui/confetti';
import { Progress } from '@/components/ui/controls';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { f, fmtDate, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';

type Kind = 'fuel_voucher' | 'supplier_discount' | 'tool' | 'cash_out' | 'other';
export interface RewardItem {
  id: string;
  kind: Kind;
  titleAr: string;
  titleEn: string;
  partnerName: string | null;
  pointsCost: number;
  valueSar: number | null;
  stock: number | null;
  minTier: 'A' | 'B' | 'C' | null;
  affordable: boolean;
  tierAllowed: boolean;
}
export interface RedemptionItem {
  id: string;
  status: 'requested' | 'fulfilled' | 'rejected' | 'canceled';
  pointsSpent: number;
  createdAt: string;
  voucherCode: string | null;
  reward: { titleAr: string; titleEn: string; kind: Kind };
}

const ICON = { fuel_voucher: Fuel, supplier_discount: Percent, tool: Wrench, cash_out: Banknote, other: Gift } as const;
const KIND_STYLE: Record<Kind, string> = {
  fuel_voucher: 'bg-accent-soft text-accent',
  supplier_discount: 'bg-navy-900 text-white dark:bg-navy-200 dark:text-navy-950',
  tool: 'bg-info-soft text-info',
  cash_out: 'bg-success-soft text-success',
  other: 'bg-surface-2 text-ink',
};
const STATUS_TONE: Record<RedemptionItem['status'], Tone> = { requested: 'info', fulfilled: 'success', rejected: 'danger', canceled: 'neutral' };

export function RewardsStore({ balance, next, items, redemptions }: { balance: number; next: { rewardTitle: string; remaining: number; pct: number } | null; items: RewardItem[]; redemptions: RedemptionItem[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [chosen, setChosen] = useState<RewardItem | null>(null);
  const [payout, setPayout] = useState('');
  const [busy, setBusy] = useState(false);
  const kinds = useMemo(() => [...new Set(items.map((i) => i.kind))], [items]);
  const shown = kind === 'all' ? items : items.filter((i) => i.kind === kind);
  const title = (r: { titleAr: string; titleEn: string }) => (locale === 'ar' ? r.titleAr : r.titleEn);

  async function redeem() {
    if (!chosen) return;
    setBusy(true);
    try {
      await api(`/rewards/${chosen.id}/redeem`, { body: { idempotencyKey: crypto.randomUUID(), payoutHandle: chosen.kind === 'cash_out' ? payout : null } });
      setChosen(null);
      confetti();
      toast(t.rewards.success);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="navy-gradient grain relative overflow-hidden rounded-3xl p-6 text-white">
        <div className="pattern-grid absolute inset-0 opacity-50" />
        <div className="relative grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <div className="text-sm text-white/70">{t.rewards.balance}</div>
            <div className="num text-5xl font-semibold">{fmtNumber(balance)}</div>
          </div>
          <div className="rounded-2xl bg-white/[.06] p-4">
            <div className="mb-2 flex justify-between text-sm text-white/80">
              <span>{t.rewards.progressTitle}</span>
              {next && <span className="num">{next.pct}%</span>}
            </div>
            {next ? (
              <>
                <Progress value={next.pct} className="bg-white/10" />
                <p className="mt-2 text-sm text-white/75">{f(t.home.remaining, { points: fmtNumber(next.remaining), reward: next.rewardTitle })}</p>
              </>
            ) : (
              <p className="text-sm text-white/75">{t.home.allAffordable}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', ...kinds] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} className={cn('press shrink-0 rounded-xl border px-3.5 py-2 text-sm transition', kind === k ? 'border-navy-900 bg-navy-900 text-white dark:border-navy-200 dark:bg-navy-200 dark:text-navy-950' : 'border-line bg-surface text-ink-2')}>
            {k === 'all' ? t.common.all : t.rewards.kinds[k]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((r) => {
          const Icon = ICON[r.kind];
          const locked = !r.tierAllowed;
          const out = r.stock !== null && r.stock <= 0;
          return (
            <div key={r.id} className={cn('surface lift flex flex-col p-5', r.affordable && !locked && 'glow-border')}>
              <div className="flex items-start justify-between gap-3">
                <div className={cn('grid size-12 place-items-center rounded-2xl', KIND_STYLE[r.kind])}>
                  <Icon className="size-6" />
                </div>
                {locked && (
                  <Badge icon={<Lock className="size-3" />}>{f(t.rewards.tierOnly, { tier: t.tiers.short[r.minTier!] })}</Badge>
                )}
              </div>
              <h3 className="mt-4 font-semibold leading-snug">{title(r)}</h3>
              {r.partnerName && <p className="mt-1 text-sm text-muted">{r.partnerName}</p>}
              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <div>
                  <div className="num text-2xl font-semibold text-ink">{fmtNumber(r.pointsCost)}</div>
                  <div className="text-xs text-muted">{t.common.points}</div>
                </div>
                <Button size="sm" variant={r.affordable ? 'accent' : 'secondary'} disabled={!r.affordable || locked || out} onClick={() => setChosen(r)}>
                  {out ? t.rewards.outOfStock : r.affordable ? t.rewards.redeem : f(t.rewards.notEnough, { points: fmtNumber(r.pointsCost - balance) })}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {redemptions.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{t.rewards.mine}</h2>
          <ul className="surface divide-y divide-line p-0">
            {redemptions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className={cn('grid size-10 place-items-center rounded-xl', KIND_STYLE[r.reward.kind])}>
                  {(() => {
                    const I = ICON[r.reward.kind];
                    return <I className="size-5" />;
                  })()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink">{title(r.reward)}</div>
                  <div className="text-xs text-muted">
                    {fmtDate(r.createdAt, locale)} · <span className="tabular">{fmtNumber(r.pointsSpent)}</span> {t.common.pointsShort}
                  </div>
                </div>
                {r.voucherCode && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(r.voucherCode!);
                      toast(t.common.copied);
                    }}
                    className="press num inline-flex items-center gap-1.5 rounded-lg border border-dashed border-accent bg-accent-soft px-2.5 py-1 text-sm text-ink"
                    aria-label={t.rewards.voucher}
                  >
                    {r.voucherCode}
                    <Copy className="size-3.5" />
                  </button>
                )}
                <Badge tone={STATUS_TONE[r.status]}>{t.rewards.statuses[r.status]}</Badge>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={!!chosen}
        onClose={() => setChosen(null)}
        title={t.rewards.confirmTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setChosen(null)}>
              {t.common.cancel}
            </Button>
            <Button variant="accent" loading={busy} onClick={redeem} disabled={chosen?.kind === 'cash_out' && payout.replace(/\D/g, '').length < 9}>
              {t.common.confirm}
            </Button>
          </>
        }
      >
        {chosen && (
          <div className="space-y-4">
            <p className="font-semibold text-ink">{title(chosen)}</p>
            <p className="text-sm text-muted">{f(t.rewards.confirmBody, { points: fmtNumber(chosen.pointsCost) })}</p>
            {chosen.kind === 'cash_out' && (
              <Field label={t.rewards.payout}>
                <Input inputMode="tel" className="num" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="05XXXXXXXX" />
              </Field>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
