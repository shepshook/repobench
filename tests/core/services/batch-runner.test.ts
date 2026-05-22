import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  BatchRunnerService, 
  BatchConfig, 
  IBatchRunner,
  BatchRunError
} from '../../../src/core/services/batch-runner';
import { 
  IWorkerPool, 
  ISessionOrchestrator, 
  IJudgeService, 
  ISandbox, 
  ICandidateRepository,
  Candidate,
  EvaluationRunResult
} from '../../../src/core/contracts';

describe('BatchRunnerService', () => {
  let service: IBatchRunner;
  let mockWorkerPool: any;
  let mockSessionOrchestratorFactory: any;
  let mockJudgeServiceFactory: any;
  let mockSandboxFactory: any;
  let mockCandidateRepository: any;

  const mockConfig: BatchConfig = {
    agentIds: ['agent-1', 'agent-2'],
    candidateIds: ['cand-1', 'cand-2', 'cand-3'],
    concurrency: 2,
    timeoutPerRun: 300000,
    dryRun: false,
  };

  const mockCandidates: Candidate[] = [
    { id: 'cand-1', hash: 'h1', message: 'm1', files: [], status: 'validated', created_at: new Date(), repositoryUrl: 'http://git.com', repositoryName: 'repo' } as any,
    { id: 'cand-2', hash: 'h2', message: 'm2', files: [], status: 'validated', created_at: new Date(), repositoryUrl: 'http://git.com', repositoryName: 'repo' } as any,
    { id: 'cand-3', hash: 'h3', message: 'm3', files: [], status: 'validated', created_at: new Date(), repositoryUrl: 'http://git.com', repositoryName: 'repo' } as any,
  ];

  beforeEach(() => {
    mockWorkerPool = {
      exec: vi.fn(),
      getActiveCount: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };

    mockSessionOrchestratorFactory = vi.fn().mockReturnValue({
      executeSession: vi.fn().mockResolvedValue({ success: true, cost: 10 }),
    });

    mockJudgeServiceFactory = vi.fn().mockReturnValue({
      runEvaluationPipeline: vi.fn().mockResolvedValue([{ 
        candidateId: 'cand-1', 
        result: { eScore: 0.8, latency: 100, success: true }, 
        cost: 10 
      }] as EvaluationRunResult[]),
    });

    mockSandboxFactory = vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    });

    mockCandidateRepository = {
      getAll: vi.fn().mockReturnValue(mockCandidates),
      getById: vi.fn().mockImplementation((id) => mockCandidates.find(c => c.id === id)),
    };

    service = new BatchRunnerService(
      mockWorkerPool,
      mockSessionOrchestratorFactory,
      mockJudgeServiceFactory,
      mockSandboxFactory,
      mockCandidateRepository,
      {} as any // BatchConfig for constructor if needed, though runAll takes it
    );
  });

  it('should create a Cartesian product of agents and candidates', async () => {
    // Mock worker pool to just return fulfilled results for all tasks
    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      return await Promise.all(tasks.map(async (t: any) => ({
        id: t.id,
        status: 'fulfilled',
        value: await t.fn(),
      })));
    });

    await service.runAll(mockConfig);

    // 2 agents * 3 candidates = 6 tasks
    expect(mockWorkerPool.exec).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String) })
      ])
    );
    const tasks = mockWorkerPool.exec.mock.calls[0][0];
    expect(tasks.length).toBe(6);
  });

  it('should resolve candidates from candidateIds if provided', async () => {
    const configWithSubset: BatchConfig = {
      ...mockConfig,
      candidateIds: ['cand-1'],
    };

    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      return await Promise.all(tasks.map(async (t: any) => ({ id: t.id, status: 'fulfilled', value: await t.fn() })));
    });

    await service.runAll(configWithSubset);

    // 2 agents * 1 candidate = 2 tasks
    const tasks = mockWorkerPool.exec.mock.calls[0][0];
    expect(tasks.length).toBe(2);
  });

  it('should resolve all validated candidates if candidateIds is not provided', async () => {
    const configWithoutCandidates: BatchConfig = {
      ...mockConfig,
      candidateIds: undefined,
    };

    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      return await Promise.all(tasks.map(async (t: any) => ({ id: t.id, status: 'fulfilled', value: await t.fn() })));
    });

    await service.runAll(configWithoutCandidates);

    expect(mockCandidateRepository.getAll).toHaveBeenCalled();
    const tasks = mockWorkerPool.exec.mock.calls[0][0];
    expect(tasks.length).toBe(6);
  });

  it('should handle partial failures and aggregate them in the summary', async () => {
    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      return tasks.map((t: any, index: number) => {
        if (index === 0) {
          return { id: t.id, status: 'rejected', error: new Error('Worker failure') };
        }
        return { id: t.id, status: 'fulfilled', value: { success: true } };
      });
    });

    const summary = await service.runAll(mockConfig);

    expect(summary.failedRuns).toBe(1);
    expect(summary.successfulRuns).toBe(5);
  });

  it('should trigger workerPool.shutdown() when cancel() is called', () => {
    service.cancel();
    expect(mockWorkerPool.shutdown).toHaveBeenCalled();
  });

  it('should execute the full pipeline for each worker task', async () => {
    let taskExecuted = false;
    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      const result = await tasks[0].fn();
      taskExecuted = true;
      return [{ id: tasks[0].id, status: 'fulfilled', value: result }];
    });

    // Only 1 agent and 1 candidate for simplicity
    const simpleConfig: BatchConfig = {
      agentIds: ['agent-1'],
      candidateIds: ['cand-1'],
      concurrency: 1,
      timeoutPerRun: 300000,
      dryRun: false,
    };

    await service.runAll(simpleConfig);

    expect(taskExecuted).toBe(true);
    expect(mockSandboxFactory).toHaveBeenCalled();
    expect(mockSessionOrchestratorFactory).toHaveBeenCalledWith('agent-1');
    expect(mockJudgeServiceFactory).toHaveBeenCalledWith('agent-1');
  });

  it('should correctly aggregate AgentRunSummary in the results map', async () => {
    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      return await Promise.all(tasks.map(async (t: any) => ({
        id: t.id,
        status: 'fulfilled',
        value: { success: true, eScore: 0.8, cost: 10, latency: 100 },
      })));
    });

    const summary = await service.runAll(mockConfig);

    expect(summary.results.has('agent-1')).toBe(true);
    expect(summary.results.has('agent-2')).toBe(true);
    
    const agent1Summary = summary.results.get('agent-1');
    expect(agent1Summary).toBeDefined();
    expect(agent1Summary?.totalRuns).toBe(3); // 3 candidates
    expect(agent1Summary?.successfulRuns).toBe(3);
    expect(agent1Summary?.avgEScore).toBe(0.8);
  });

  it('should wrap errors in BatchRunError with full context', async () => {
    mockWorkerPool.exec.mockImplementation(async (tasks: any[]) => {
      return tasks.map((t: any) => ({
        id: t.id,
        status: 'rejected',
        error: new BatchRunError({
          agentId: 'agent-1',
          candidateId: 'cand-1',
          message: 'Critical failure',
          stdout: 'some output',
          stderr: 'some error',
        }),
      }));
    });

    const summary = await service.runAll(mockConfig);
    expect(summary.failedRuns).toBeGreaterThan(0);
  });
});
