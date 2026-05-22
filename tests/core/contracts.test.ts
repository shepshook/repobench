import { describe, it, expect } from 'vitest';
import { ValidationResultSchema, IBenchmarkValidator, IDoneDetector, CompletionSignature, CompletionSignatureSchema, AgentConfigSchema, ISearchEfficiencyTracker, IScorer, ISemanticJudge, RunResultSchema, IRunResultRepository, RunResult } from '../../src/core/contracts';

describe('ISemanticJudge', () => {
  it('should be implementable by a mock class', () => {
    class MockJudge implements ISemanticJudge {
      async judge(code: string): Promise<any> {
        return {
          correctness: 5,
          maintainability: 5,
          idiomaticity: 5,
        };
      }
    }
    const judge: ISemanticJudge = new MockJudge();
    expect(judge).toBeDefined();
  });
});

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

  it('should throw an error for invalid types in ValidationResult', () => {
    const invalidResult = {
      isValid: "true", // invalid type
      preFixStatus: 'fail',
      postFixStatus: 'pass',
      preFixOutput: '...',
      postFixOutput: '...',
      latency: 100,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => ValidationResultSchema.parse(invalidResult)).toThrow();
  });
});

describe('IScorer', () => {
  it('should be implementable by a mock class and calculate E-Score correctly', () => {
    class MockScorer implements IScorer {
      calculateEScore(data: {
        success: number;
        cost: number;
        latency: number;
        efficiencyMultiplier: number;
      }): number {
        return (data.success / (data.cost * Math.log(data.latency))) * data.efficiencyMultiplier;
      }
    }
    const scorer: IScorer = new MockScorer();
    const eScore = scorer.calculateEScore({ success: 1, cost: 10, latency: 100, efficiencyMultiplier: 1 });
    // E-Score = 1 / (10 * Math.log(100)) * 1 = 1 / (10 * 4.605) = 1 / 46.05 = 0.0217
    expect(eScore).toBeCloseTo(0.0217);
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

describe('ISearchEfficiencyTracker', () => {
  it('should be implementable by a mock class', () => {
    class MockTracker implements ISearchEfficiencyTracker {
      trackAccess(file: string): void { /* no-op */ }
      trackModification(file: string): void { /* no-op */ }
      getMetrics(): any { return { filesAccessed: 0, filesModified: 0, timeTakenMs: 0, tokensUsed: 0 }; }
    }
    const tracker: ISearchEfficiencyTracker = new MockTracker();
    expect(tracker).toBeDefined();
  });
});

describe('RunResultSchema', () => {
  it('should validate a correct RunResult object', () => {
    const validRunResult = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      agentId: 'test-agent-1',
      candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      metrics: {
        success: true,
        cost: 0.05,
        latency: 1200,
        eScore: 0.85,
      },
      timestamp: new Date(),
      logPath: '/logs/run-1.log',
    };
    expect(() => RunResultSchema.parse(validRunResult)).not.toThrow();
  });

  it('should validate a RunResult without logPath', () => {
    const validRunResult = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      agentId: 'test-agent-1',
      candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      metrics: {
        success: false,
        cost: 0.02,
        latency: 500,
        eScore: 0.1,
      },
      timestamp: new Date(),
    };
    expect(() => RunResultSchema.parse(validRunResult)).not.toThrow();
  });

  it('should throw an error for invalid UUIDs', () => {
    const invalidRunResult = {
      runId: 'not-a-uuid',
      agentId: 'test-agent-1',
      candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      metrics: {
        success: true,
        cost: 0.05,
        latency: 1200,
        eScore: 0.85,
      },
      timestamp: new Date(),
    };
    // @ts-expect-error - testing runtime validation
    expect(() => RunResultSchema.parse(invalidRunResult)).toThrow();
  });

  it('should throw an error for missing required fields in metrics', () => {
    const invalidRunResult = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      agentId: 'test-agent-1',
      candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      metrics: {
        success: true,
        // missing cost, latency, eScore
      },
      timestamp: new Date(),
    };
    // @ts-expect-error - testing runtime validation
    expect(() => RunResultSchema.parse(invalidRunResult)).toThrow();
  });
});

describe('IRunResultRepository', () => {
  it('should be implementable by a mock class', () => {
    class MockRepository implements IRunResultRepository {
      private results: Map<string, RunResult> = new Map();

      save(run: RunResult): void {
        this.results.set(run.runId, run);
      }

      getById(runId: string): RunResult | undefined {
        return this.results.get(runId);
      }

      getAll(): RunResult[] {
        return Array.from(this.results.values());
      }

      getByAgentId(agentId: string): RunResult[] {
        return Array.from(this.results.values()).filter(r => r.agentId === agentId);
      }

      getByCandidateId(candidateId: string): RunResult[] {
        return Array.from(this.results.values()).filter(r => r.candidateId === candidateId);
      }
    }

    const repo: IRunResultRepository = new MockRepository();
    const testRun: RunResult = {
      runId: '550e8400-e29b-41d4-a716-446655440000',
      agentId: 'agent-1',
      candidateId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      metrics: { success: true, cost: 1, latency: 1, eScore: 1 },
      timestamp: new Date(),
    };

    repo.save(testRun);
    expect(repo.getById(testRun.runId)).toEqual(testRun);
    expect(repo.getAll()).toContainEqual(testRun);
    expect(repo.getByAgentId('agent-1')).toContainEqual(testRun);
    expect(repo.getByCandidateId('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toContainEqual(testRun);
  });
});
