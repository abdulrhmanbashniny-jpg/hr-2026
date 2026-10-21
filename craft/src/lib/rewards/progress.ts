export interface RewardLike {
  id: string;
  pointsCost: number;
}

/** The cheapest reward still out of reach, how far away it is, and the progress towards it. */
export function nextReward<T extends RewardLike>(balance: number, rewards: T[]): { reward: T; remaining: number; pct: number } | null {
  const ahead = rewards.filter((r) => r.pointsCost > balance).sort((a, b) => a.pointsCost - b.pointsCost);
  const reward = ahead[0];
  if (!reward) return null;
  const below = rewards.filter((r) => r.pointsCost <= balance).sort((a, b) => b.pointsCost - a.pointsCost)[0];
  const floor = below?.pointsCost ?? 0;
  const pct = Math.max(0, Math.min(100, Math.round(((balance - floor) / (reward.pointsCost - floor)) * 100)));
  return { reward, remaining: reward.pointsCost - balance, pct };
}
