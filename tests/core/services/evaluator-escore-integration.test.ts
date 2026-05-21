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
import { EScoreService } from '../../../src/core/services/e-score-service';
import { IScorer } from '../../../src/core/contracts';

describe('EvaluatorPipeline E-Score Integration', () => {
  let evaluator: Evaluator;
  let mockSandbox: ISandbox;
  let mockRunner: IRegressionTestRunner;
  let mockConfig: SandboxConfig;

  beforeEach(() => {
    mockSandbox = {
      id: 'test-sandbox',
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      switchState: vi.fn().mockResolvedValue(undefined),
      getFileAccessTracker: vi.fn().mockReturnValue({
        getModifiedFiles: vi.fn().mockReturnValue([]),
        getAccessedFiles: vi.fn().mockReturnValue([]),
        getDeletedFiles: vi.fn().mockReturnValue([]),
      }),
    } as any;

    mockRunner = {
      runTests: vi.fn(),
      compareResults: vi.fn(),
    } as any;

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

  it('should calculate and attach eScore to evaluation results', async () => {
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

    // Cast to any to check for eScore before implementation
    const result: any = await evaluator.evaluate(mockCandidate);

    expect(result).toHaveProperty('eScore');
    expect(typeof result.eScore).toBe('number');
    expect(result.eScore).toBeGreaterThan(0);
  });
});
