import { z } from 'zod';

export const CostMetricsSchema = z.object({
  promptTokens: z.number().nonnegative(),
  completionTokens: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  currency: z.string(),
});

export type CostMetrics = z.infer<typeof CostMetricsSchema>;
