import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ISandbox, 
  SandboxConfig, 
  IRegressionTestRunner, 
  Candidate, 
  TestResults, 
  ComparisonResult 
} from '../../../src/core/contracts';
import { Evaluator } from '../../../src/core/services/evaluator';
import { IEvaluator, EvaluationResult } from '../../../src/core/contracts';

describe('Evaluator', () => {
  let evaluator: Evaluator;
  let mockSandbox: ISandbox;
  let mockRunner: IRegressionTestRunner;
  let mockConfig: SandboxConfig;

  beforeEach(() => {
    mockSandbox = {
      id: 'test-sandbox',
      config: { project: 'test-project' },
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(),
      switchState: vi.fn().mockResolvedValue(undefined),
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      getFilesystemSnapshot: vi.fn().mockResolvedValue([]),
      getCacheStats: vi.fn().mockResolvedValue({ hits: 0, misses: 0 }),
      ping: vi.fn().mockResolvedValue(true),
    };

    mockRunner = {
      runTests: vi.fn(),
      compareResults: vi.fn(),
    };

    mockConfig = {
      testCommand: 'npm test',
      project: 'test-project',
    };

    evaluator = new Evaluator(mockSandbox, mockConfig, mockRunner);
  });

  const mockCandidate: Candidate = {
    id: 'test-candidate-id',
    hash: 'post-hash',
    preFixHash: 'pre-hash',
    postFixHash: 'post-hash',
    message: 'fix bug',
    files: ['file1.ts'],
    status: 'pending',
    created_at: new Date(),
    repositoryUrl: 'https://github.com/test/repo',
    repositoryName: 'test-repo',
  };

  it('should mark as clean when no regression is detected', async () => {
    const preResults: TestResults = {
      stdout: 'pre-out',
      stderr: '',
      exitCode: 0,
      duration: 100,
      passed: true,
    };
    const postResults: TestResults = {
      stdout: 'post-out',
      stderr: '',
      exitCode: 0,
      duration: 100,
      passed: true,
    };
    const comparison: ComparisonResult = {
      status: 'unchanged',
      diff: '',
      summary: 'No changes',
    };

    (mockRunner.runTests as any)
      .mockResolvedValueOnce(preResults)
      .mockResolvedValueOnce(postResults);
    (mockRunner.compareResults as any).mockReturnValue(comparison);

    const result: EvaluationResult = await evaluator.evaluate(mockCandidate);

    expect(result.regressionStatus).toBe('clean');
    expect(result.candidateId).toBe(mockCandidate.id);
    expect(result.comparison).toEqual(comparison);
    expect(result.preTestResults).toEqual(preResults);
    expect(result.postTestResults).toEqual(postResults);
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('should handle zero latency correctly', async () => {
    const preResults: TestResults = {
      stdout: 'pre-out',
      stderr: '',
      exitCode: 0,
      duration: 0,
      passed: true,
    };
    const postResults: TestResults = {
      stdout: 'post-out',
      stderr: '',
      exitCode: 0,
      duration: 0,
      passed: true,
    };
    const comparison: ComparisonResult = {
      status: 'unchanged',
      diff: '',
      summary: 'No changes',
    };

    (mockRunner.runTests as any)
      .mockResolvedValueOnce(preResults)
      .mockResolvedValueOnce(postResults);
    (mockRunner.compareResults as any).mockReturnValue(comparison);

    const result: EvaluationResult = await evaluator.evaluate(mockCandidate);

    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('should mark as regressed when compareResults returns regressed', async () => {
    const preResults: TestResults = {
      stdout: 'pre-out',
      stderr: '',
      exitCode: 0,
      duration: 100,
      passed: true,
    };
    const postResults: TestResults = {
      stdout: 'post-out',
      stderr: 'error',
      exitCode: 1,
      duration: 100,
      passed: false,
    };
    const comparison: ComparisonResult = {
      status: 'regressed',
      diff: 'diff',
      summary: 'Regression detected',
    };

    (mockRunner.runTests as any)
      .mockResolvedValueOnce(preResults)
      .mockResolvedValueOnce(postResults);
    (mockRunner.compareResults as any).mockReturnValue(comparison);

    const result: EvaluationResult = await evaluator.evaluate(mockCandidate);

    expect(result.regressionStatus).toBe('regressed');
    expect(result.comparison).toEqual(comparison);
  });

  it('should mark as error when sandbox.switchState fails', async () => {
    mockSandbox.switchState.mockRejectedValue(new Error('Sandbox error'));

    const result: EvaluationResult = await evaluator.evaluate(mockCandidate);

    expect(result.regressionStatus).toBe('error');
    expect(result.message).toContain('Sandbox error');
  });

  it('should follow the correct execution sequence', async () => {
    const preResults: TestResults = { stdout: 'pre', stderr: '', exitCode: 0, duration: 10, passed: true };
    const postResults: TestResults = { stdout: 'post', stderr: '', exitCode: 0, duration: 10, passed: true };
    
    (mockRunner.runTests as any).mockResolvedValueOnce(preResults).mockResolvedValueOnce(postResults);
    (mockRunner.compareResults as any).mockReturnValue({ status: 'unchanged', diff: '', summary: '' });

    await evaluator.evaluate(mockCandidate);

    expect(mockSandbox.switchState).toHaveBeenNthCalledWith(1, 'pre-hash');
    expect(mockRunner.runTests).toHaveBeenNthCalledWith(1, mockSandbox, 'npm test');
    expect(mockSandbox.switchState).toHaveBeenNthCalledWith(2, 'post-hash');
    expect(mockRunner.runTests).toHaveBeenNthCalledWith(2, mockSandbox, 'npm test');
    expect(mockRunner.compareResults).toHaveBeenCalledWith(preResults, postResults);
  });
});
