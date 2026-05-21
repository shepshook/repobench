import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgeService } from '../../../src/core/services/judge-service';
import { ISandbox, SandboxConfig, Candidate, IEvaluator, EvaluationResult } from '../../../src/core/contracts';

describe('JudgeService', () => {
  let sandbox: ISandbox;
  let config: SandboxConfig;
  let evaluator: IEvaluator;
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

    judge = new JudgeService(sandbox, config, evaluator);
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
    expect(evaluator.evaluate).toHaveBeenCalledWith(mockCandidate);
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

    await judge.runEvaluationPipeline([mockCandidate], costMap);

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
});
