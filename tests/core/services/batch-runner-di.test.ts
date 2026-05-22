import { describe, it, expect, vi } from 'vitest';
import { BatchRunnerService, BatchConfig } from '../../../src/core/services/batch-runner';

describe('BatchRunnerService DI', () => {
  const mockWorkerPool = {
    exec: vi.fn().mockImplementation(async (tasks) => {
      const results = [];
      for (const task of tasks) {
        try {
          const value = await task.fn();
          results.push({ id: task.id, status: 'fulfilled', value });
        } catch (error) {
          results.push({ id: task.id, status: 'rejected', error });
        }
      }
      return results;
    }),
    getActiveCount: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
  const mockSessionOrchestratorFactory = vi.fn();
  const mockJudgeServiceFactory = vi.fn();
  const mockSandboxFactory = vi.fn();
  const mockCandidateRepository = {
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn(),
  };

  it('should NOT use hardcoded fallbacks when invalid agentConfigs are provided', async () => {
    // If we pass an object instead of an array, it should not magically 
    // populate itself with 'agent-1', 'agent-2', etc.
    const service = new BatchRunnerService(
      mockWorkerPool,
      mockSessionOrchestratorFactory,
      mockJudgeServiceFactory,
      mockSandboxFactory,
       mockCandidateRepository,
       [] as any, // Empty agentConfigs — triggers "Agent configuration not found"
       { agentIds: ['agent-1'], candidateIds: [], concurrency: 1, timeoutPerRun: 1000, dryRun: false }
    );

    const config: BatchConfig = {
      agentIds: ['agent-1'],
      candidateIds: [],
      concurrency: 1,
      timeoutPerRun: 1000,
      dryRun: false,
    };

    // This should fail if no fallback is used, because agentConfigs is empty/invalid.
    // If it succeeds or uses the fallback, this test will fail (since we expect it to fail).
    
    // To make the test "failing" in the current state, we assert that it SHOULD 
    // throw an error because we passed an invalid config.
    
    // We need to mock the repository to return at least one candidate so it doesn't exit early.
    mockCandidateRepository.getAll.mockReturnValue([
      { id: 'cand-1', hash: 'h1', message: 'm1', files: [], status: 'validated', created_at: new Date(), repositoryUrl: 'http://git.com', repositoryName: 'repo' } as any,
    ]);

    // We expect the service to throw "Agent configuration not found" 
    // because we passed [] as agentConfigs.
    // If it doesn't throw, it means the fallback is active.
    await expect(service.runAll(config)).rejects.toThrow('Agent configuration not found for agent-1');
  });
});
