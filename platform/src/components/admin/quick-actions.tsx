'use client';

import { Check, Clock } from 'lucide-react';
import { useTransition } from 'react';
import { approvePayment } from '@/app/admin/actions';
import { extendTrial } from '@/app/admin/tenants/actions';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n/client';
import type { ActionResult } from '@/lib/action-result';

function useRun() {
  const toast = useToast();
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? (r.message ?? t.common.saved) : r.error, r.ok ? 'ok' : 'err');
    });
  return { pending, run };
}

export function ExtendTrialButton({ tenantId, days = 7 }: { tenantId: string; days?: number }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  return (
    <button
      type="button"
      className="ui-btn ui-btn--outline ui-btn--sm"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set('days', String(days));
        run(() => extendTrial(tenantId, null, fd));
      }}
    >
      <Clock size={15} />+{days}
      <span className="sr-only">{t.console.tenants.extend}</span>
    </button>
  );
}

export function ApprovePaymentButton({ paymentId }: { paymentId: string }) {
  const { t } = useI18n();
  const { pending, run } = useRun();
  return (
    <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled={pending} onClick={() => window.confirm(`${t.admin.approve}?`) && run(() => approvePayment(paymentId))}>
      <Check size={15} />
      {t.admin.approve}
    </button>
  );
}
