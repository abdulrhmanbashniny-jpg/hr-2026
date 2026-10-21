import { z } from 'zod';
import { apiStaff } from '@/lib/auth/guards';
import { ApiError, ok, readJson, route } from '@/lib/http';
import { approveInvoice, rejectInvoice } from '@/lib/invoices/pipeline';

const Body = z.object({ ids: z.array(z.uuid()).min(1).max(200), action: z.enum(['approve', 'reject']), note: z.string().max(300).optional() });

/** One-click batch review. Each invoice is its own transaction, so one failure never blocks the rest. */
export const POST = route(async (req) => {
  const s = await apiStaff('invoices:review');
  const { ids, action, note } = await readJson(req, Body);
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of ids) {
    try {
      if (action === 'approve') await approveInvoice(id, s.user.id, note);
      else await rejectInvoice(id, s.user.id, note);
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err instanceof ApiError ? err.code : 'generic' });
    }
  }
  return ok({ results, succeeded: results.filter((r) => r.ok).length });
});
