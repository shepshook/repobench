import { describe, it, expect } from 'vitest';
import { ValidationResultSchema, IBenchmarkValidator, IDoneDetector, CompletionSignature, CompletionSignatureSchema, AgentConfigSchema } from '../../src/core/contracts';

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

describe('IDoneDetector', () => {
  it('should be implementable by a mock class', () => {
    class MockDoneDetector implements IDoneDetector {
      isDone(output: string): boolean {
        return output.includes('DONE');
      }
    }
    const detector: IDoneDetector = new MockDoneDetector();
    expect(detector.isDone('Task is DONE')).toBe(true);
    expect(detector.isDone('Task is not done')).toBe(false);
  });
});

describe('CompletionSignature', () => {
  it('should be usable as a type for signature collections', () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'Finished', name: 'basic' },
      { pattern: 'Task complete', name: 'detailed' },
    ];
    expect(signatures).toHaveLength(2);
    expect(signatures[0].pattern).toBe('Finished');
  });
});

describe('CompletionSignatureSchema', () => {
    it('should validate a correct CompletionSignature object', () => {
        const validSignature = {
            pattern: 'Finished',
            name: 'basic',
        };
        expect(() => CompletionSignatureSchema.parse(validSignature)).not.toThrow();
    });

    it('should throw an error for missing required fields', () => {
        const invalidSignature = {
            pattern: 'Finished',
        };
        // @ts-expect-error - testing runtime validation
        expect(() => CompletionSignatureSchema.parse(invalidSignature)).toThrow();
    });

    it('should throw an error for invalid types', () => {
        const invalidSignature = {
            pattern: 123,
            name: 'basic',
        };
        // @ts-expect-error - testing runtime validation
        expect(() => CompletionSignatureSchema.parse(invalidSignature)).toThrow();
    });
});

describe('AgentConfigSchema', () => {
    it('should validate a correct AgentConfig object', () => {
        const validConfig = {
            agentId: 'test-agent',
            model: 'gpt-4',
            temperature: 0.7,
            systemPrompt: 'You are a helpful assistant',
            cliArgs: ['--verbose'],
            max_tokens: 1000,
            completionSignatures: [{ pattern: 'Done', name: 'completion' }],
        };
        expect(() => AgentConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should throw an error for missing required fields', () => {
        const invalidConfig = {
            agentId: 'test-agent',
            // missing model, temperature, etc.
        };
        // @ts-expect-error - testing runtime validation
        expect(() => AgentConfigSchema.parse(invalidConfig)).toThrow();
    });

    it('should throw an error for invalid temperature', () => {
        const invalidConfig = {
            agentId: 'test-agent',
            model: 'gpt-4',
            temperature: 2.5, // max 2
            systemPrompt: '...',
            cliArgs: [],
        };
        // @ts-expect-error - testing runtime validation
        expect(() => AgentConfigSchema.parse(invalidConfig)).toThrow();
    });
});

