import { describe, it, expect } from 'vitest';
import { CostMetricsSchema, ICostParser } from '../../src/core/contracts';
import { CostParser } from '../../src/core/services/cost-parser';

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

describe('CostParser', () => {
  const parser = new CostParser();

  it('should parse standard cost format', () => {
    const logs = 'Agent output...\nPrompt tokens: 123, Completion tokens: 45, Cost: 0.012 USD\nMore output...';
    const result = parser.parse(logs);
    expect(result).toEqual({
      promptTokens: 123,
      completionTokens: 45,
      totalTokens: 168,
      cost: 0.012,
      currency: 'USD',
    });
  });

  it('should parse alternative cost format with $ symbol', () => {
    const logs = 'Total tokens used: 168 (123 prompt, 45 completion). Cost: $0.012';
    const result = parser.parse(logs);
    expect(result).toEqual({
      promptTokens: 123,
      completionTokens: 45,
      totalTokens: 168,
      cost: 0.012,
      currency: 'USD',
    });
  });

  it('should return zero metrics for logs without cost information', () => {
    const logs = 'Hello world!\nThis is a sample log with no costs.';
    const result = parser.parse(logs);
    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      currency: 'USD',
    });
  });

  it('should handle multiple cost entries by taking the last one', () => {
    const logs = 'First run: Prompt tokens: 10, Completion tokens: 5, Cost: 0.001 USD\nSecond run: Prompt tokens: 100, Completion tokens: 50, Cost: 0.01 USD';
    const result = parser.parse(logs);
    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      cost: 0.01,
      currency: 'USD',
    });
  });

  it('should handle partial output with only prompt tokens', () => {
    const logs = 'Prompt tokens: 100, Completion tokens: missing, Cost: missing';
    const result = parser.parse(logs);
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(0);
    expect(result.cost).toBe(0);
  });

  it('should handle partial output with only cost', () => {
    const logs = 'Cost: 0.05 USD';
    const result = parser.parse(logs);
    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.cost).toBe(0.05);
  });

  it('should handle malformed numeric values gracefully', () => {
    const logs = 'Prompt tokens: abc, Completion tokens: def, Cost: ghi USD';
    const result = parser.parse(logs);
    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      currency: 'USD',
    });
  });
});
