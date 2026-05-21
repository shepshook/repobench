import { z } from 'zod';

export const SemanticScoreSchema = z.object({
  correctness: z.number().int().min(1).max(5),
  maintainability: z.number().int().min(1).max(5),
  idiomaticity: z.number().int().min(1).max(5),
});

export type SemanticScore = z.infer<typeof SemanticScoreSchema>;
