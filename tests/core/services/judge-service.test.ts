import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgeService } from '../../../src/core/services/judge-service';
import { ISandbox, SandboxConfig, Candidate, IEvaluator, EvaluationResult, IRunResultRepository, RunResult } from '../../../src/core/contracts';

describe('JudgeService', () => {
  let sandbox: ISandbox;
  let config: SandboxConfig;
  let evaluator: IEvaluator;
  let repository: IRunResultRepository;
  let judge: JudgeService;

  beforeEach(() => {
    sandbox = {
      id: 'test-sandbox',
      config: { project: 'test-project' },
      init: vi.fn(),
      destroy: vi.fn(),
      execute: vi.fn(),
      switchState: vi.fn(),
      createSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
      getFilesystemSnapshot: vi.fn(),
      getCacheStats: vi.fn(),
      ping: vi.fn(),
    };

    config = { project: 'test-project' };

    evaluator = {
      evaluate: vi.fn(),
    };

    repository = {
      save: vi.fn(),
      getById: vi.fn(),
      getAll: vi.fn(),
      getByAgentId: vi.fn(),
      getByCandidateId: vi.fn(),
    };

    judge = new JudgeService(sandbox, config, evaluator, repository);
  });

  const mockCandidate: Candidate = {
    id: 'test-candidate-1',
    hash: 'abc123',
    message: 'fix bug',
    files: ['src/index.ts'],
    status: 'validated',
    created_at: new Date(),
    repositoryUrl: 'https://github.com/test/repo',
    repositoryName: 'test/repo',
    preFixHash: 'abc122',
    postFixHash: 'abc123',
  };

  it('should iterate over candidates and delegate to evaluator', async () => {
    const mockResult: EvaluationResult = {
      candidateId: 'test-candidate-1',
      regressionStatus: 'clean',
      comparison: null,
      preTestResults: null,
      postTestResults: null,
      latency: 100,
      message: 'No regressions detected.',
    };

    (evaluator.evaluate as any).mockResolvedValue(mockResult);

    const results = await judge.runEvaluationPipeline([mockCandidate]);

    expect(results).toHaveLength(1);
    expect(results[0].candidateId).toBe('test-candidate-1');
    expect(results[0].result.regressionStatus).toBe('clean');
    expect(evaluator.evaluate).toHaveBeenCalledWith(mockCandidate, undefined);
  });

  it('should pass cost data from costMap to evaluator', async () => {
    const costMap = new Map<string, number>([['test-candidate-1', 123]]);
    const mockResult: EvaluationResult = {
      candidateId: 'test-candidate-1',
      regressionStatus: 'clean',
      comparison: null,
      preTestResults: null,
      postTestResults: null,
      latency: 100,
      message: 'No regressions detected.',
    };

    (evaluator.evaluate as any).mockResolvedValue(mockResult);

    await judge.runEvaluationPipeline([mockCandidate], 'test-agent', costMap);

    expect(evaluator.evaluate).toHaveBeenCalledWith(mockCandidate, 123);
  });

  it('should collect results for multiple candidates', async () => {
    const candidate2: Candidate = { ...mockCandidate, id: 'test-candidate-2' };
    (evaluator.evaluate as any)
      .mockResolvedValueOnce({
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 50,
        message: 'Clean',
      })
      .mockResolvedValueOnce({
        candidateId: 'test-candidate-2',
        regressionStatus: 'regressed',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 60,
        message: 'Regression found',
      });

    const results = await judge.runEvaluationPipeline([mockCandidate, candidate2]);

    expect(results).toHaveLength(2);
    expect(results[0].result.regressionStatus).toBe('clean');
    expect(results[1].result.regressionStatus).toBe('regressed');
    expect(evaluator.evaluate).toHaveBeenCalledTimes(2);
  });

  it('should propagate errors from evaluator', async () => {
    (evaluator.evaluate as any).mockRejectedValue(new Error('Evaluator error'));

    await expect(judge.runEvaluationPipeline([mockCandidate])).rejects.toThrow('Evaluator error');
  });

  it('should handle empty candidate list', async () => {
    const results = await judge.runEvaluationPipeline([]);
    expect(results).toHaveLength(0);
  });

  describe('Persistence Integration', () => {
    const agentId = 'test-agent-123';
    const logPath = '/logs/test-run.log';

    it('should save results to repository when runEvaluationPipeline is called', async () => {
      const mockResult: EvaluationResult = {
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'No regressions detected.',
        eScore: 1.0,
      };
      (evaluator.evaluate as any).mockResolvedValue(mockResult);

      await judge.runEvaluationPipeline([mockCandidate], agentId);

      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        agentId: agentId,
        candidateId: 'test-candidate-1',
        metrics: expect.objectContaining({
          success: true,
          latency: 100,
        }),
      }));
    });

    it('should map regressionStatus "clean" to success: true', async () => {
      (evaluator.evaluate as any).mockResolvedValue({
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Clean',
        eScore: 1.0,
      });

      await judge.runEvaluationPipeline([mockCandidate], agentId);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        metrics: expect.objectContaining({ success: true }),
      }));
    });

    it('should map regressionStatus "regressed" to success: false', async () => {
      (evaluator.evaluate as any).mockResolvedValue({
        candidateId: 'test-candidate-1',
        regressionStatus: 'regressed',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Regressed',
        eScore: 0.5,
      });

      await judge.runEvaluationPipeline([mockCandidate], agentId);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        metrics: expect.objectContaining({ success: false }),
      }));
    });

    it('should not crash pipeline if repository.save fails', async () => {
      (evaluator.evaluate as any).mockResolvedValue({
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Clean',
        eScore: 1.0,
      });
      (repository.save as any).mockImplementation(() => {
        throw new Error('DB Error');
      });

      const results = await judge.runEvaluationPipeline([mockCandidate], agentId);
      expect(results).toHaveLength(1); // Pipeline should complete
    });


    it('should include logPath in persisted RunResult if provided', async () => {
      (evaluator.evaluate as any).mockResolvedValue({
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Clean',
        eScore: 1.0,
      });

      await judge.runEvaluationPipeline([mockCandidate], agentId, new Map(), logPath);
      expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
        logPath: logPath,
      }));
    });

    it('should include a valid UUID as runId and a Date object as timestamp', async () => {
      (evaluator.evaluate as any).mockResolvedValue({
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Clean',
        eScore: 1.0,
      });

      await judge.runEvaluationPipeline([mockCandidate], agentId);

      const savedRun = (repository.save as any).mock.calls[0][0];
      expect(savedRun.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(savedRun.timestamp).toBeInstanceOf(Date);
    });

    it('should persist cost correctly, defaulting to 0 if not provided', async () => {
      (evaluator.evaluate as any).mockResolvedValue({
        candidateId: 'test-candidate-1',
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Clean',
        eScore: 1.0,
      });

      // Case 1: Cost not provided
      await judge.runEvaluationPipeline([mockCandidate], agentId);
      expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        metrics: expect.objectContaining({ cost: 0 }),
      }));

      // Case 2: Cost provided via costMap
      const costMap = new Map([['test-candidate-1', 50]]);
      await judge.runEvaluationPipeline([mockCandidate], agentId, costMap);
      expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        metrics: expect.objectContaining({ cost: 50 }),
      }));
    });
  });
});
