import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JudgeService } from '../../src/core/services/judge-service';
import { RunResultRepository } from '../../src/core/repositories/run-result-repository';
import { ISandbox, SandboxConfig, Candidate, IEvaluator, EvaluationResult } from '../../src/core/contracts';
import { reinitDatabase, db } from '../../src/infrastructure/persistence/database';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

describe('Judge Persistence Integration', () => {
  let sandbox: ISandbox;
  let config: SandboxConfig;
  let evaluator: IEvaluator;
  let repository: RunResultRepository;
  let judge: JudgeService;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `judge-persist-test-db-${Date.now()}-${Math.random()}.db`);
    await     reinitDatabase(tempDbPath);
    
    repository = new RunResultRepository(db);
    
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
      getFileAccessTracker: vi.fn(),
    };

    config = { project: 'test-project' };

    evaluator = {
      evaluate: vi.fn(),
    };

    judge = new JudgeService(sandbox, config, evaluator, repository);
  });

  afterEach(async () => {
    try {
      await fs.unlink(tempDbPath);
    } catch {}
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

  it('should persist evaluation results to the database', async () => {
    const agentId = 'test-agent-123';
    const logPath = '/logs/test-run.log';
    const mockResult: EvaluationResult = {
      candidateId: mockCandidate.id,
      regressionStatus: 'clean',
      comparison: null,
      preTestResults: null,
      postTestResults: null,
      latency: 100,
      message: 'Clean',
      eScore: 1.0,
    };
    (evaluator.evaluate as any).mockResolvedValue(mockResult);

    // Use intended signature: (candidates, agentId, logPath, costMap)
    await judge.runEvaluationPipeline([mockCandidate], agentId, undefined, logPath);

    const persisted = repository.getByCandidateId(mockCandidate.id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].agentId).toBe(agentId);
    expect(persisted[0].logPath).toBe(logPath);
    expect(persisted[0].metrics.success).toBe(true);
    expect(persisted[0].metrics.latency).toBe(100);
  });

  it('should mark result as failed when regressionStatus is regressed', async () => {
    const agentId = 'test-agent-123';
    const mockResult: EvaluationResult = {
      candidateId: mockCandidate.id,
      regressionStatus: 'regressed',
      comparison: null,
      preTestResults: null,
      postTestResults: null,
      latency: 200,
      message: 'Regressed',
      eScore: 0.5,
    };
    (evaluator.evaluate as any).mockResolvedValue(mockResult);

    await judge.runEvaluationPipeline([mockCandidate], agentId);

    const persisted = repository.getByCandidateId(mockCandidate.id);
    expect(persisted[0].metrics.success).toBe(false);
  });

  it('should handle multiple candidates and persist each one', async () => {
    const agentId = 'test-agent-123';
    const candidate2: Candidate = { ...mockCandidate, id: 'test-candidate-2' };
    
    (evaluator.evaluate as any)
      .mockResolvedValueOnce({
        candidateId: mockCandidate.id,
        regressionStatus: 'clean',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 100,
        message: 'Clean',
        eScore: 1.0,
      })
      .mockResolvedValueOnce({
        candidateId: candidate2.id,
        regressionStatus: 'regressed',
        comparison: null,
        preTestResults: null,
        postTestResults: null,
        latency: 150,
        message: 'Regressed',
        eScore: 0.4,
      });

    await judge.runEvaluationPipeline([mockCandidate, candidate2], agentId);

    const allRuns = repository.getAll();
    expect(allRuns).toHaveLength(2);
    
    const run1 = repository.getByCandidateId(mockCandidate.id)[0];
    const run2 = repository.getByCandidateId(candidate2.id)[0];
    
    expect(run1.metrics.success).toBe(true);
    expect(run2.metrics.success).toBe(false);
  });
});
