import type { subscriptions } from '@/db/schema';

type Sub = typeof subscriptions.$inferSelect;

export const PAST_DUE_GRACE_DAYS = 3;

export function subscriptionState(sub: Sub, now = new Date()) {
  const trialActive = sub.status === 'trialing' && !!sub.trialEndsAt && sub.trialEndsAt > now;
  const periodEnd = sub.currentPeriodEnd;
  const paidActive = (sub.status === 'active' || sub.status === 'past_due') && !!periodEnd && periodEnd.getTime() + PAST_DUE_GRACE_DAYS * 86_400_000 > now.getTime();
  const endsAt = sub.status === 'trialing' ? sub.trialEndsAt : periodEnd;
  const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000) : null;
  return {
    id: sub.id,
    status: sub.status,
    planId: sub.planId,
    billingCycle: sub.billingCycle,
    isTrial: sub.status === 'trialing',
    trialEndsAt: sub.trialEndsAt,
    currentPeriodEnd: periodEnd,
    daysLeft,
    canWrite: trialActive || paidActive,
  };
}
