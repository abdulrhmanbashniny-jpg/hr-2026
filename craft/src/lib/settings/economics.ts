import { z } from 'zod';

export const economicsSchema = z.object({
  /** Points earned per SAR of pre-VAT invoice value. */
  pointsPerSar: z.number().min(0).max(100),
  /** SAR value of one point, used for liability and cash-out. */
  pointValueSar: z.number().min(0).max(10),
  tierMultipliers: z.object({ A: z.number().min(1).max(5), B: z.number().min(1).max(5), C: z.number().min(1).max(5) }),
  welcomeBonus: z.number().int().min(0).max(100_000),
  referralBonus: z.number().int().min(0).max(100_000),
  commissionL1Pct: z.number().min(0).max(50),
  commissionL2Pct: z.number().min(0).max(50),
  maxMultiplier: z.number().min(1).max(10),
  invoiceMaxAgeDays: z.number().int().min(1).max(365),
  invoiceMaxAmountSar: z.number().min(1),
  dailyInvoiceCap: z.number().int().min(1).max(100),
  autoApproveMaxRisk: z.number().int().min(0).max(100),
  flagMinRisk: z.number().int().min(0).max(100),
});

export type Economics = z.infer<typeof economicsSchema>;

export const DEFAULT_ECONOMICS: Economics = {
  pointsPerSar: 1,
  pointValueSar: 0.025,
  tierMultipliers: { A: 1.25, B: 1.1, C: 1 },
  welcomeBonus: 100,
  referralBonus: 300,
  commissionL1Pct: 5,
  commissionL2Pct: 2,
  maxMultiplier: 3,
  invoiceMaxAgeDays: 30,
  invoiceMaxAmountSar: 50_000,
  dailyInvoiceCap: 5,
  autoApproveMaxRisk: 20,
  flagMinRisk: 60,
};

export function resolveEconomics(stored: unknown): Economics {
  const parsed = economicsSchema.partial().safeParse(stored ?? {});
  return { ...DEFAULT_ECONOMICS, ...(parsed.success ? parsed.data : {}) };
}
