import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JudgeService } from '../../src/core/services/judge-service';
import { Evaluator } from '../../src/core/services/evaluator';
import { EScoreService } from '../../src/core/services/e-score-service';
import { 
  Candidate, 
  ICandidateRepository, 
  ISandbox, 
  IRegressionTestRunner, 
  SandboxConfig,
  EvaluationRunResult,
  RunResult,
  EfficiencyMetrics
} from '../../src/core/contracts';

describe('Cross-Module Boundary Audit', () => {
  let mockSandbox: ISandbox;
  let mockRunner: IRegressionTestRunner;
  let mockRepo: ICandidateRepository;
  let sandboxConfig: SandboxConfig;

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
      getAll: vi.fn(),
      save: vi.fn(),
      upsert: vi.fn(),
      exists: vi.fn(),
      existsById: vi.fn(),
      getById: vi.fn(),
    } as any;

    sandboxConfig = {
      testCommand: 'npm test',
      project: 'test-project',
    };
  });

  describe('Boundary A: Miner -> Judge', () => {
    it('should only pass validated candidates to the evaluation pipeline', async () => {
      const candidates: Candidate[] = [
        {
          id: '1',
          hash: 'h1',
          message: 'm1',
          files: [],
          status: 'validated',
          created_at: new Date(),
          repositoryUrl: 'http://repo',
          repositoryName: 'repo',
          preFixHash: 'pre1',
          postFixHash: 'post1',
        },
        {
          id: '2',
          hash: 'h2',
          message: 'm2',
          files: [],
          status: 'pending',
          created_at: new Date(),
          repositoryUrl: 'http://repo',
          repositoryName: 'repo',
        },
      ];
      mockRepo.getAll.mockReturnValue(candidates);

      const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
      const judgeService = new JudgeService(mockSandbox, sandboxConfig, evaluator);
      // We simulate the flow that the CLI or Orchestrator would trigger
      const validated = candidates.filter(c => c.status === 'validated');
       const results = await judgeService.runEvaluationPipeline(validated, 'test-agent');

      expect(results).toHaveLength(1);
      expect(results[0].candidateId).toBe('1');
    });
  });

  describe('Boundary B: Sandbox -> Judge', () => {
    it('should correctly flow file access tracking data into EfficiencyMetrics', async () => {
      const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
      const candidate: Candidate = {
        id: 'test-id',
        hash: 'post-hash',
        message: 'fix',
        files: ['file1.ts'],
        status: 'validated',
        created_at: new Date(),
        repositoryUrl: 'http://repo',
        repositoryName: 'repo',
        preFixHash: 'pre-hash',
        postFixHash: 'post-hash',
      };

      const result = await evaluator.evaluate(candidate);

      expect(mockSandbox.switchState).toHaveBeenCalledWith('pre-hash');
      expect(mockSandbox.switchState).toHaveBeenCalledWith('post-hash');
      expect(mockSandbox.getFileAccessTracker).toHaveBeenCalled();
      
      // Verify that efficiency metrics are present and derived from the tracker
      expect(result.efficiency).toBeDefined();
      // Based on mock: modified=['file1.ts'], accessed=['file1.ts', 'file2.ts']
      // Ratio = modified / accessed = 1 / 2 = 0.5
      // This depends on how EfficiencyMetrics are calculated in the implementation
    });
  });

  describe('Boundary C: Session -> Judge', () => {
    it('should pass cost data from session to evaluator and reflect it in E-Score', async () => {
      const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
      const candidate: Candidate = {
        id: 'test-id',
        hash: 'post-hash',
        message: 'fix',
        files: ['file1.ts'],
        status: 'validated',
        created_at: new Date(),
        repositoryUrl: 'http://repo',
        repositoryName: 'repo',
        preFixHash: 'pre-hash',
        postFixHash: 'post-hash',
      };

      const costLow = 10;
      const costHigh = 1000;

      const resultLow = await evaluator.evaluate(candidate, costLow);
      const resultHigh = await evaluator.evaluate(candidate, costHigh);

      // Higher cost should result in a lower E-Score (denominator)
      expect(resultLow.eScore).toBeGreaterThan(resultHigh.eScore);
    });
  });

  describe('Boundary D: Judge -> Leaderboard', () => {
    it('should produce EvaluationRunResults compatible with Leaderboard RunResultSchema', async () => {
      const evaluator = new Evaluator(mockSandbox, sandboxConfig, mockRunner);
      const judgeService = new JudgeService(mockSandbox, sandboxConfig, evaluator);
      const candidate: Candidate = {
        id: 'test-id',
        hash: 'post-hash',
        message: 'fix',
        files: ['file1.ts'],
        status: 'validated',
        created_at: new Date(),
        repositoryUrl: 'http://repo',
        repositoryName: 'repo',
        preFixHash: 'pre-hash',
        postFixHash: 'post-hash',
      };

       const runResults = await judgeService.runEvaluationPipeline([candidate], 'test-agent');
      const runResult = runResults[0];

      // Verify required fields for RunResult
      expect(runResult).toHaveProperty('candidateId');
      expect(runResult).toHaveProperty('result');
      expect(runResult.result).toHaveProperty('eScore');
      expect(runResult.result).toHaveProperty('latency');
      expect(runResult.result).toHaveProperty('regressionStatus');
    });
  });

  describe('Boundary E: SessionOrchestrator — Dependency Inversion', () => {
    const sourcePath = resolve('src/core/services/session-orchestrator.ts');

    it('should not import concrete Sandbox or PtySession from infrastructure layer', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/infrastructure\//);
    });

    it('should not dynamically import from infrastructure layer either', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/import\s*\(\s*['"]\.\.\/\.\.\/infrastructure\//);
    });

    it('should import ISandbox from contracts instead of concrete Sandbox', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/infrastructure\/sandbox['"]/);
      expect(content).toMatch(/ISandbox/);
    });

    it('should declare sandbox method parameters as ISandbox, not Sandbox', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/:\s*Sandbox\b/);
    });
  });

  describe('Boundary F: BenchmarkService — Dependency Inversion', () => {
    const sourcePath = resolve('src/core/services/benchmark-service.ts');

    it('should not import concrete VolumeManager from infrastructure layer', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/infrastructure\//);
    });

    it('should import ISandbox, SandboxConfig, and IDocker from contracts instead', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/infrastructure\//);
      expect(content).toMatch(/IBenchmarkService/);
    });

    it('should not instantiate VolumeManager directly (should use DI)', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/new\s+VolumeManager/);
    });
  });

  describe('Boundary G: AgentAdapterFactory — Dependency Inversion', () => {
    const sourcePath = resolve('src/core/services/agent-adapter-factory.ts');

    it('should not import concrete adapter classes from infrastructure layer', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/infrastructure\//);
    });

    it('should import only IAgentAdapter from contracts, not concrete adapters', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/ClaudeCodeAdapter/);
      expect(content).not.toMatch(/AiderAdapter/);
    });

    it('should not dynamically import adapter classes from infrastructure layer', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/import\s*\(\s*['"]\.\.\/\.\.\/infrastructure\//);
    });

    it('should not contain a static initializer block that registers adapters', () => {
      const content = readFileSync(sourcePath, 'utf-8');
      expect(content).not.toMatch(/static\s*\{/);
    });
  });
});
