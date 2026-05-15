import { describe, it, expect } from 'vitest';
import { ValidationResultSchema, IBenchmarkValidator } from '../../src/core/contracts';

describe('ValidationResultSchema', () => {
  it('should validate a correct ValidationResult object', () => {
    const validResult = {
      isValid: true,
      preFixStatus: 'fail',
      postFixStatus: 'pass',
      preFixOutput: 'Error: test failed',
      postFixOutput: 'All tests passed',
      latency: 1200,
    };
    expect(() => ValidationResultSchema.parse(validResult)).not.toThrow();
  });

  it('should throw an error for missing required fields', () => {
    const invalidResult = {
      preFixStatus: 'fail',
      postFixStatus: 'pass',
      preFixOutput: '...',
      postFixOutput: '...',
      latency: 100,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => ValidationResultSchema.parse(invalidResult)).toThrow();
  });

  it('should throw an error for invalid enum values in preFixStatus', () => {
    const invalidResult = {
      isValid: true,
      preFixStatus: 'unknown',
      postFixStatus: 'pass',
      preFixOutput: '...',
      postFixOutput: '...',
      latency: 100,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => ValidationResultSchema.parse(invalidResult)).toThrow();
  });

  it('should throw an error for invalid enum values in postFixStatus', () => {
    const invalidResult = {
      isValid: true,
      preFixStatus: 'fail',
      postFixStatus: 'unknown',
      preFixOutput: '...',
      postFixOutput: '...',
      latency: 100,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => ValidationResultSchema.parse(invalidResult)).toThrow();
  });
});

describe('IBenchmarkValidator', () => {
  it('should be implementable by a mock class', () => {
    class MockValidator implements IBenchmarkValidator {
      async validate(candidate: any): Promise<any> {
        return {
          isValid: true,
          preFixStatus: 'fail',
          postFixStatus: 'pass',
          preFixOutput: 'fail',
          postFixOutput: 'pass',
          latency: 100,
        };
      }
    }
    const validator: IBenchmarkValidator = new MockValidator();
    expect(validator).toBeDefined();
  });
});
