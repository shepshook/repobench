import { describe, it, expect } from 'vitest';
import { 
  BatchConfigSchema, 
  IBatchRunner, 
  IWorkerPool, 
  BatchRunSummary, 
  AgentRunSummary, 
  WorkerTask, 
  WorkerResult 
} from '../../src/core/contracts';

describe('BatchConfigSchema', () => {
  it('should validate a correct BatchConfig object', () => {
    const validConfig = {
      agentIds: ['agent-1', 'agent-2'],
      candidateIds: ['550e8400-e29b-41d4-a716-446655440000'],
      concurrency: 4,
      timeoutPerRun: 60000,
      dryRun: true,
    };
    expect(() => BatchConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('should apply default values for optional fields', () => {
    const minimalConfig = {
      agentIds: ['agent-1'],
    };
    const parsed = BatchConfigSchema.parse(minimalConfig);
    expect(parsed.concurrency).toBe(2);
    expect(parsed.timeoutPerRun).toBe(300000);
    expect(parsed.dryRun).toBe(false);
    expect(parsed.candidateIds).toBeUndefined();
  });

  it('should throw an error if agentIds is empty', () => {
    const invalidConfig = {
      agentIds: [],
    };
    // @ts-expect-error - testing runtime validation
    expect(() => BatchConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('should throw an error if concurrency is out of bounds', () => {
    const invalidConfig = {
      agentIds: ['agent-1'],
      concurrency: 11,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => BatchConfigSchema.parse(invalidConfig)).toThrow();
  });

  it('should not throw an error if timeoutPerRun is low', () => {
    const invalidConfig = {
      agentIds: ['agent-1'],
      timeoutPerRun: 59999,
    };
    // @ts-expect-error - testing runtime validation
    expect(() => BatchConfigSchema.parse(invalidConfig)).not.toThrow();
  });

  it('should not throw an error for invalid UUIDs in candidateIds', () => {
    const invalidConfig = {
      agentIds: ['agent-1'],
      candidateIds: ['not-a-uuid'],
    };
    // @ts-expect-error - testing runtime validation
    expect(() => BatchConfigSchema.parse(invalidConfig)).not.toThrow();
  });
});

describe('IBatchRunner', () => {
  it('should be implementable by a mock class', () => {
    class MockBatchRunner implements IBatchRunner {
      async runAll(config: any): Promise<BatchRunSummary> {
        return {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          results: new Map(),
          totalDuration: 0,
          startedAt: new Date(),
          completedAt: new Date(),
        };
      }
      cancel(): void {
        // no-op
      }
    }
    const runner: IBatchRunner = new MockBatchRunner();
    expect(runner).toBeDefined();
  });
});

describe('IWorkerPool', () => {
  it('should be implementable by a mock class', () => {
    class MockWorkerPool implements IWorkerPool {
      async exec<T>(tasks: WorkerTask<T>[]): Promise<WorkerResult<T>[]> {
        return tasks.map(t => ({ id: t.id, status: 'fulfilled', value: {} as T }));
      }
      getActiveCount(): number {
        return 0;
      }
      async shutdown(): Promise<void> {
        // no-op
      }
    }
    const pool: IWorkerPool = new MockWorkerPool();
    expect(pool).toBeDefined();
  });
});

describe('BatchRunSummary', () => {
  it('should be usable as a type for aggregation', () => {
    const summary: BatchRunSummary = {
      totalRuns: 10,
      successfulRuns: 8,
      failedRuns: 2,
      results: new Map(),
      totalDuration: 1000,
      startedAt: new Date(),
      completedAt: new Date(),
    };
    expect(summary.totalRuns).toBe(10);
  });
});

describe('AgentRunSummary', () => {
  it('should be usable as a type for per-agent stats', () => {
    const agentSummary: AgentRunSummary = {
      agentId: 'agent-1',
      totalRuns: 5,
      successfulRuns: 4,
      avgEScore: 0.8,
      avgCost: 0.05,
      avgLatency: 1200,
    };
    expect(agentSummary.agentId).toBe('agent-1');
  });
});

describe('WorkerTask and WorkerResult', () => {
  it('should support generic types for results', () => {
    type TestResult = { score: number };
    const task: WorkerTask<TestResult> = {
      id: 'task-1',
      fn: async () => ({ score: 100 }),
    };
    const result: WorkerResult<TestResult> = {
      id: 'task-1',
      status: 'fulfilled',
      value: { score: 100 },
    };
    expect(task.id).toBe('task-1');
    expect(result.value?.score).toBe(100);
  });

  it('should handle rejected results', () => {
    const result: WorkerResult<any> = {
      id: 'task-2',
      status: 'rejected',
      error: new Error('Failed'),
    };
    expect(result.status).toBe('rejected');
    expect(result.error?.message).toBe('Failed');
  });
});
