import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  Candidate, 
  ICandidateRepository, 
  ISandbox, 
  IRegressionTestRunner, 
  SandboxConfig,
  RepoBenchConfig
} from '../../src/core/contracts';
import { GitMiner } from '../../src/core/services/miner';
import { JudgeService } from '../../src/core/services/judge-service';
import { Evaluator } from '../../src/core/services/evaluator';

describe('Full Pipeline Integration Simulation', () => {
  let mockSandbox: ISandbox;
  let mockRunner: IRegressionTestRunner;
  let mockRepo: ICandidateRepository;
  let sandboxConfig: SandboxConfig;
  let miningConfig: RepoBenchConfig;

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
        getModifiedFiles: vi.fn().mockReturnValue(['file1.ts']),
        getAccessedFiles: vi.fn().mockReturnValue(['file1.ts', 'file2.ts']),
        getDeletedFiles: vi.fn().mockReturnValue([]),
      }),
    } as any;

    mockRunner = {
      runTests: vi.fn().mockResolvedValue({
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
        duration: 100,
        passed: true,
      }),
      compareResults: vi.fn().mockReturnValue({
        status: 'unchanged',
        diff: '',
        summary: 'No changes',
      }),
    } as any;

    mockRepo = {
      save: vi.fn(),
      upsert: vi.fn(),
      exists: vi.fn().mockReturnValue(false),
      existsById: vi.fn().mockReturnValue(false),
      getById: vi.fn(),
      getAll: vi.fn(),
    } as any;

    sandboxConfig = {
      testCommand: 'npm test',
      project: 'test-project',
    };

    miningConfig = {
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
      },
    };
  });

  it('should execute the full pipeline from mining to evaluation', async () => {
    // 1. Mine: Use a mock miner or GitMiner with a mock repo
    const miner = new GitMiner(mockRepo);
    // We mock mineCommits because it requires a real git repo on disk
    vi.spyOn(miner, 'mineCommits').mockResolvedValue([
      {
        id: 'cand-1',
        hash: 'h1',
        message: 'fix: bug 1',
        files: ['file1.ts'],
        status: 'pending',
        created_at: new Date(),
        repositoryUrl: 'http://repo',
        repositoryName: 'repo',
        preFixHash: 'pre1',
        postFixHash: 'post1',
      }
    ]);

    const minedCandidates = await miner.mineCommits(miningConfig);
    expect(minedCandidates).toHaveLength(1);

    // 2. Validate: Simulate validation process
    const validatedCandidates = minedCandidates.map(c => ({
      ...c,
      status: 'validated' as const,
    }));

    // 3. Persist: Save to DB
    validatedCandidates.forEach(c => mockRepo.save(c));
    expect(mockRepo.save).toHaveBeenCalledTimes(1);

    // 4. Evaluate: Run the evaluation pipeline
    mockRepo.getAll.mockReturnValue(validatedCandidates);
    const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
    const judgeService = new JudgeService(mockSandbox, sandboxConfig, evaluator);
    
    // Retrieve from repo and evaluate
    const candidatesToEval = mockRepo.getAll().filter(c => c.status === 'validated');
    const results = await judgeService.runEvaluationPipeline(candidatesToEval);

    // 5. Verify: Check output contains E-Scores and regression statuses
    expect(results).toHaveLength(1);
    const result = results[0];
    
    expect(result).toHaveProperty('candidateId', 'cand-1');
    expect(result.result).toHaveProperty('eScore');
    expect(typeof result.result.eScore).toBe('number');
    expect(result.result).toHaveProperty('regressionStatus');
    expect(['clean', 'regressed', 'error']).toContain(result.result.regressionStatus);
  });

  it('should handle candidates with missing hashes without crashing', async () => {
    const invalidCandidate: Candidate = {
      id: 'invalid-1',
      hash: 'h1',
      message: 'fix',
      files: [],
      status: 'validated',
      created_at: new Date(),
      repositoryUrl: 'http://repo',
      repositoryName: 'repo',
    };
    const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
    const judgeService = new JudgeService(mockSandbox, sandboxConfig, evaluator);
    
    // This should not throw
    const results = await judgeService.runEvaluationPipeline([invalidCandidate]);
    
    expect(results).toHaveLength(1);
    expect(results[0].result.regressionStatus).toBe('error');
    expect(results[0].result.message).toMatch(/missing.*hash/i);
  });

  it('should report proper error messages when sandbox operations fail', async () => {
    const candidate: Candidate = {
      id: 'cand-1',
      hash: 'h1',
      message: 'fix',
      files: [],
      status: 'validated',
      created_at: new Date(),
      repositoryUrl: 'http://repo',
      repositoryName: 'repo',
      preFixHash: 'pre1',
      postFixHash: 'post1',
    };
    mockSandbox.switchState.mockRejectedValue(new Error('Sandbox failure'));
    const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
    const judgeService = new JudgeService(mockSandbox, sandboxConfig, evaluator);

    const results = await judgeService.runEvaluationPipeline([candidate]);
    
    expect(results[0].result.regressionStatus).toBe('error');
    expect(results[0].result.message).toContain('Sandbox failure');
  });
});
