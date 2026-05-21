import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ISandbox, 
  SandboxConfig, 
  IRegressionTestRunner, 
  Candidate, 
  TestResults, 
  ComparisonResult,
  ISemanticJudge
} from '../../../src/core/contracts';
import { Evaluator } from '../../../src/core/services/evaluator';

describe('EvaluatorPipeline Semantic Judge Integration', () => {
  let evaluator: Evaluator;
  let mockSandbox: ISandbox;
  let mockRunner: IRegressionTestRunner;
  let mockConfig: SandboxConfig;
  let mockSemanticJudge: ISemanticJudge;

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

    mockSemanticJudge = {
      judge: vi.fn().mockResolvedValue({
        correctness: 4,
        maintainability: 4,
        idiomaticity: 4
      }),
    };


    // This will fail because the current Evaluator constructor doesn't accept the semantic judge
    evaluator = new Evaluator(mockSandbox, mockConfig, mockRunner, undefined, mockSemanticJudge);
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

  it('should run semantic judge after binary tests and include score in results', async () => {
    const preResults: TestResults = { stdout: 'pre', stderr: '', exitCode: 0, duration: 10, passed: true };
    const postResults: TestResults = { stdout: 'post', stderr: '', exitCode: 0, duration: 10, passed: true };
    const comparison: ComparisonResult = { status: 'unchanged', diff: '', summary: 'OK' };

    (mockRunner.runTests as any).mockResolvedValueOnce(preResults).mockResolvedValueOnce(postResults);
    (mockRunner.compareResults as any).mockReturnValue(comparison);

    const result: any = await evaluator.evaluate(mockCandidate);

    expect(mockSemanticJudge.judge).toHaveBeenCalled();
    expect(result).toHaveProperty('semanticScore');
    expect(result.semanticScore.correctness).toBe(4);

  });
});
