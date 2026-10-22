'use client';

import { BadgeCheck, CircleX, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Badge, type Tone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, ApiClientError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { f, fmtDate, fmtMoney, fmtNumber } from '@/lib/i18n/format';
import { useI18n } from '@/lib/i18n/client';
import type { InvoiceExtraction } from '@/lib/invoices/types';
import { useConsole } from './console-i18n';

export interface QueueRow {
  id: string;
  status: 'processing' | 'pending' | 'flagged' | 'approved' | 'rejected';
  riskScore: number;
  reasons: { code: string; weight: number; detail?: Record<string, string | number> }[];
  qrSignature: 'absent' | 'unsigned' | 'valid' | 'invalid';
  qrPhase: number | null;
  sellerName: string | null;
  sellerVat: string | null;
  invoiceNumber: string | null;
  totalAmount: number | null;
  vatAmount: number | null;
  declaredAmount: number | null;
  issuedAt: string | null;
  createdAt: string;
  pointsAwarded: number;
  extraction: InvoiceExtraction | null;
  reviewNote: string | null;
  craftsman: { id: string; name: string; code: string; tier: 'A' | 'B' | 'C' };
  dealer: string | null;
  city: string | null;
}

const SIG_ICON = { valid: ShieldCheck, invalid: ShieldAlert, unsigned: ShieldQuestion, absent: ShieldQuestion } as const;
const SIG_TONE: Record<QueueRow['qrSignature'], Tone> = { valid: 'success', invalid: 'danger', unsigned: 'neutral', absent: 'warning' };

function riskTone(score: number): Tone {
  return score >= 60 ? 'danger' : score > 20 ? 'warning' : 'success';
}

export function InvoiceQueue({ rows, actionable }: { rows: QueueRow[]; actionable: boolean }) {
  const { t, locale } = useI18n();
  const c = useConsole();
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<QueueRow | null>(null);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  function act(ids: string[], action: 'approve' | 'reject') {
    start(async () => {
      try {
        const r = await api<{ succeeded: number }>('/admin/invoices/batch', { body: { ids, action, note: note || undefined } });
        toast(f(c.invoices.done, { n: r.succeeded }));
        setSelected(new Set());
        setOpen(null);
        setNote('');
        router.refresh();
      } catch (e) {
        toast(e instanceof ApiClientError ? e.message : t.errors.generic, 'error');
      }
    });
  }

  if (!rows.length) return <EmptyState icon={<BadgeCheck className="size-6" />} title={c.invoices.empty} />;
  const all = selected.size === rows.length;
  return (
    <div className="space-y-3">
      {actionable && selected.size > 0 && (
        <div className="glass sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-2xl p-2 shadow-md">
          <Button size="sm" variant="accent" loading={pending} onClick={() => act([...selected], 'approve')}>
            {f(c.invoices.approveSelected, { n: selected.size })}
          </Button>
          <Button size="sm" variant="danger" disabled={pending} onClick={() => act([...selected], 'reject')}>
            {f(c.invoices.rejectSelected, { n: selected.size })}
          </Button>
        </div>
      )}
      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-xs text-muted">
            <tr>
              {actionable && (
                <th className="w-10 p-3">
                  <input type="checkbox" aria-label={t.common.all} checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-[#f59e0b]" />
                </th>
              )}
              <th className="p-3 text-start font-medium">{c.invoices.risk}</th>
              <th className="p-3 text-start font-medium">{c.invoices.craftsman}</th>
              <th className="p-3 text-start font-medium">{c.invoices.dealer}</th>
              <th className="p-3 text-start font-medium">{c.invoices.signature}</th>
              <th className="p-3 text-end font-medium">{c.invoices.amount}</th>
              <th className="p-3 text-start font-medium">{c.invoices.date}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const Sig = SIG_ICON[r.qrSignature];
              return (
                <tr key={r.id} className={cn('cursor-pointer hover:bg-surface-2/60', selected.has(r.id) && 'bg-accent-soft/60')} onClick={() => setOpen(r)}>
                  {actionable && (
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={r.id}
                        checked={selected.has(r.id)}
                        onChange={() =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (n.has(r.id)) n.delete(r.id);
                            else n.add(r.id);
                            return n;
                          })
                        }
                        className="size-4 accent-[#f59e0b]"
                      />
                    </td>
                  )}
                  <td className="p-3">
                    <Badge tone={riskTone(r.riskScore)}>
                      <span className="num">{r.riskScore}</span>
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-ink">{r.craftsman.name}</div>
                    <div className="num text-xs text-muted">
                      {r.craftsman.code} · {r.craftsman.tier}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="max-w-56 truncate text-ink-2">{r.dealer ?? r.sellerName ?? c.invoices.unknownDealer}</div>
                    {r.city && <div className="text-xs text-muted">{r.city}</div>}
                  </td>
                  <td className="p-3">
                    <Badge tone={SIG_TONE[r.qrSignature]} icon={<Sig className="size-3.5" />}>
                      {c.invoices.signatures[r.qrSignature]}
                    </Badge>
                  </td>
                  <td className="tabular p-3 text-end text-ink">{fmtMoney(r.totalAmount, locale, 2)}</td>
                  <td className="p-3 text-muted">{fmtDate(r.createdAt, locale, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={c.invoices.detail}
        wide
        footer={
          open && actionable && (open.status === 'pending' || open.status === 'flagged') ? (
            <>
              <Button variant="danger" icon={<CircleX className="size-4" />} disabled={pending} onClick={() => act([open.id], 'reject')}>
                {c.invoices.reject}
              </Button>
              <Button variant="accent" icon={<BadgeCheck className="size-4" />} loading={pending} onClick={() => act([open.id], 'approve')}>
                {c.invoices.approve}
              </Button>
            </>
          ) : undefined
        }
      >
        {open && (
          <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
            <a href={`/api/v1/invoices/${open.id}/image`} target="_blank" rel="noopener" className="block overflow-hidden rounded-2xl border border-line bg-surface-2">
              <img src={`/api/v1/invoices/${open.id}/image`} alt="" className="max-h-[60dvh] w-full object-contain" />
            </a>
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={riskTone(open.riskScore)}>
                  {c.invoices.risk} <span className="num">{open.riskScore}</span>
                </Badge>
                <Badge tone={SIG_TONE[open.qrSignature]}>{c.invoices.signatures[open.qrSignature]}</Badge>
                {open.qrPhase && <Badge>Phase {open.qrPhase}</Badge>}
              </div>
              <section>
                <h3 className="mb-2 text-xs font-semibold text-muted">{c.invoices.qr}</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted">{c.invoices.dealer}</dt>
                  <dd className="text-ink">{open.dealer ?? open.sellerName ?? '—'}</dd>
                  <dt className="text-muted">VAT</dt>
                  <dd className="num text-ink">{open.sellerVat ?? '—'}</dd>
                  <dt className="text-muted">{c.invoices.amount}</dt>
                  <dd className="tabular text-ink">{fmtMoney(open.totalAmount, locale, 2)}</dd>
                  <dt className="text-muted">{c.invoices.declared}</dt>
                  <dd className="tabular text-ink">{fmtMoney(open.declaredAmount, locale, 2)}</dd>
                  <dt className="text-muted">{c.invoices.date}</dt>
                  <dd className="text-ink">{fmtDate(open.issuedAt, locale, true)}</dd>
                  {open.pointsAwarded > 0 && (
                    <>
                      <dt className="text-muted">{c.invoices.points}</dt>
                      <dd className="num font-semibold text-success">+{fmtNumber(open.pointsAwarded)}</dd>
                    </>
                  )}
                </dl>
              </section>
              {open.extraction && (
                <section className="rounded-xl bg-info-soft/60 p-3">
                  <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-info">
                    <Sparkles className="size-3.5" />
                    {c.invoices.ai}
                  </h3>
                  <p className="text-ink-2">
                    {open.extraction.sellerName ?? '—'} · <span className="tabular">{fmtMoney(open.extraction.total, locale, 2)}</span>
                    {open.extraction.notes ? ` — ${open.extraction.notes}` : ''}
                  </p>
                </section>
              )}
              <section>
                <h3 className="mb-2 text-xs font-semibold text-muted">{c.invoices.reasons}</h3>
                {open.reasons.length ? (
                  <ul className="space-y-1.5">
                    {open.reasons.map((r) => (
                      <li key={r.code} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                        <span className="text-ink-2">{t.risk[r.code as keyof typeof t.risk] ?? r.code}</span>
                        {r.weight > 0 && <span className="num text-xs text-muted">+{r.weight}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">{c.invoices.noReasons}</p>
                )}
              </section>
              {actionable && (open.status === 'pending' || open.status === 'flagged') && (
                <Field label={c.invoices.note}>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
                </Field>
              )}
              {open.reviewNote && <p className="rounded-lg bg-surface-2 p-3 text-ink-2">{open.reviewNote}</p>}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
