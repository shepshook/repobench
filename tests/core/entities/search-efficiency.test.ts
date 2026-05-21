import { describe, it, expect } from 'vitest';
import { EfficiencyMetricsSchema } from '../../src/core/entities/search-efficiency';

describe('EfficiencyMetricsSchema', () => {
  it('should validate a correct EfficiencyMetrics object', () => {
    const validMetrics = {
      filesAccessed: 10,
      filesModified: 2,
      timeTakenMs: 1500,
      tokensUsed: 500,
    };
    expect(() => EfficiencyMetricsSchema.parse(validMetrics)).not.toThrow();
  });

  it('should throw an error for negative values', () => {
    const invalidMetrics = {
      filesAccessed: -1,
      filesModified: 2,
      timeTakenMs: 1500,
      tokensUsed: 500,
    };
    expect(() => EfficiencyMetricsSchema.parse(invalidMetrics)).toThrow();
  });
});
