import { z } from 'zod';

/**
 * Metrics tracking the search efficiency of the agent.
 *
 * Definitions:
 * - filesAccessed: The number of unique file paths that the agent read from the filesystem during the session.
 * - filesModified: The number of unique file paths that the agent wrote to or modified on the filesystem during the session.
 */
export const EfficiencyMetricsSchema = z.object({
  filesAccessed: z.number().int().nonnegative(),
  filesModified: z.number().int().nonnegative(),
  timeTakenMs: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  efficiencyRatio: z.number().nonnegative().optional(),
});

export type EfficiencyMetrics = z.infer<typeof EfficiencyMetricsSchema>;
