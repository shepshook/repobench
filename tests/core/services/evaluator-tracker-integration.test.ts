import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ISandbox, 
  SandboxConfig, 
  IRegressionTestRunner, 
  Candidate, 
  TestResults, 
  ISearchEfficiencyTracker 
} from '../../../src/core/contracts';
import { Evaluator } from '../../../src/core/services/evaluator';

describe('Evaluator SearchEfficiencyTracker Integration', () => {
  let evaluator: Evaluator;
  let mockSandbox: ISandbox;
  let mockRunner: IRegressionTestRunner;
  let mockConfig: SandboxConfig;
  let mockTracker: ISearchEfficiencyTracker;

  beforeEach(() => {
    mockTracker = {
      trackAccess: vi.fn(),
      trackModification: vi.fn(),
      updateTimeTaken: vi.fn(),
      updateTokensUsed: vi.fn(),
      getMetrics: vi.fn().mockReturnValue({ tokensUsed: 0, timeTakenMs: 0, fileAccessRatio: 0 }),
    };

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
        getModifiedFiles: () => ['file1.ts'],
        getAccessedFiles: () => ['file1.ts'],
        getDeletedFiles: () => [],
      }),
    };

    mockRunner = {
      runTests: vi.fn().mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 10,
        passed: true,
      }),
      compareResults: vi.fn().mockReturnValue({
        status: 'unchanged',
        diff: '',
        summary: 'No changes',
      }),
    };

    mockConfig = {
      testCommand: 'npm test',
      project: 'test-project',
    };

    // This is the line that will fail because we can't inject the tracker
    evaluator = new Evaluator(mockSandbox, mockConfig, mockRunner);
  });

  it('should track search efficiency during evaluation', async () => {
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

    await evaluator.evaluate(mockCandidate, mockTracker);

    // This assertion should fail because the tracker is not integrated
    expect(mockTracker.trackAccess).toHaveBeenCalled();
    expect(mockTracker.trackModification).toHaveBeenCalled();
  });
});
