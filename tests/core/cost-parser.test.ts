import { describe, it, expect } from 'vitest';
import { CostMetricsSchema, ICostParser } from '../../src/core/contracts';

describe('CostMetricsSchema', () => {
  it('should validate a correct CostMetrics object', () => {
    const validMetrics = {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cost: 0.002,
      currency: 'USD',
    };
    expect(() => CostMetricsSchema.parse(validMetrics)).not.toThrow();
  });

  it('should throw an error for missing required fields', () => {
    const invalidMetrics = {
      promptTokens: 100,
      // completionTokens missing
      totalTokens: 150,
      cost: 0.002,
      currency: 'USD',
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CostMetricsSchema.parse(invalidMetrics)).toThrow();
  });

  it('should throw an error for invalid types', () => {
    const invalidMetrics = {
      promptTokens: '100', // should be number
      completionTokens: 50,
      totalTokens: 150,
      cost: 0.002,
      currency: 'USD',
    };
    // @ts-expect-error - testing runtime validation
    expect(() => CostMetricsSchema.parse(invalidMetrics)).toThrow();
  });
});

describe('ICostParser', () => {
  it('should be implementable by a mock class', () => {
    class MockCostParser implements ICostParser {
      parse(logs: string): any {
        return {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          cost: 0.0001,
          currency: 'USD',
        };
      }
    }
    const parser: ICostParser = new MockCostParser();
    const result = parser.parse('some logs');
    expect(result).toBeDefined();
    expect(result.totalTokens).toBe(15);
  });
});
