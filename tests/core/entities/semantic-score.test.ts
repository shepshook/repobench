import { describe, it, expect } from 'vitest';
import { SemanticScoreSchema } from '../../../src/core/entities/evaluation-results';

describe('SemanticScoreSchema', () => {
  it('should validate a correct SemanticScore object', () => {
    const validScore = {
      correctness: 5,
      maintainability: 4,
      idiomaticity: 3,
    };
    expect(() => SemanticScoreSchema.parse(validScore)).not.toThrow();
  });

  it('should throw an error for values out of range (1-5)', () => {
    const tooHigh = {
      correctness: 6,
      maintainability: 4,
      idiomaticity: 3,
    };
    const tooLow = {
      correctness: 0,
      maintainability: 4,
      idiomaticity: 3,
    };
    expect(() => SemanticScoreSchema.parse(tooHigh)).toThrow();
    expect(() => SemanticScoreSchema.parse(tooLow)).toThrow();
  });

  it('should throw an error for non-integer values', () => {
    const nonInt = {
      correctness: 4.5,
      maintainability: 4,
      idiomaticity: 3,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => SemanticScoreSchema.parse(nonInt)).toThrow();
  });

  it('should throw an error for missing fields', () => {
    const invalidScore = {
      correctness: 5,
      // missing maintainability and idiomaticity
    };
    // @ts-expect-error - testing runtime validation
    expect(() => SemanticScoreSchema.parse(invalidScore)).toThrow();
  });
});
