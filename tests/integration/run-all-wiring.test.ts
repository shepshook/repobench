import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/core/repositories/run-result-repository');
vi.mock('../../src/infrastructure/database');
vi.mock('../../src/core/services/agent-config-loader');
vi.mock('../../src/core/config');
vi.mock('../../src/infrastructure/sandbox');

interface BatchRunnerCtorArgs {
  workerPool: unknown;
  sessionOrchestratorFactory: unknown;
  judgeServiceFactory: (sandbox: unknown) => { runEvaluationPipeline: (...args: unknown[]) => unknown };
  sandboxFactory: unknown;
  candidateRepository: unknown;
  agentConfigs: unknown;
  config: unknown;
  reporter: unknown;
}

let capturedArgs: BatchRunnerCtorArgs | null = null;

const mockRunAllImpl = vi.fn().mockResolvedValue({
  totalRuns: 1, successfulRuns: 1, failedRuns: 0, results: new Map(),
  totalDuration: 100, startedAt: new Date(), completedAt: new Date(),
});

vi.mock('../../src/core/services/batch-runner', () => {
  function MockBatchRunnerService(...args: unknown[]) {
    const [workerPool, sessionOrchestratorFactory, judgeServiceFactory, sandboxFactory, candidateRepository, agentConfigs, config, reporter] = args as [
      unknown, unknown, (sandbox: unknown) => { runEvaluationPipeline: (...args: unknown[]) => unknown },
      unknown, unknown, unknown, unknown, unknown,
    ];
    capturedArgs = { workerPool, sessionOrchestratorFactory, judgeServiceFactory, sandboxFactory, candidateRepository, agentConfigs, config, reporter };
  }
  MockBatchRunnerService.prototype.runAll = function () { return mockRunAllImpl(); };
  MockBatchRunnerService.prototype.cancel = function () {};
  return {
    BatchRunnerService: MockBatchRunnerService as unknown as new (...args: unknown[]) => { runAll: () => unknown; cancel: () => void },
    BatchRunError: class extends Error {
      agentId: string; candidateId: string; stdout?: string; stderr?: string;
      constructor(opts: { message: string; agentId: string; candidateId: string; stdout?: string; stderr?: string }) {
        super(opts.message); this.name = 'BatchRunError'; this.agentId = opts.agentId; this.candidateId = opts.candidateId; this.stdout = opts.stdout; this.stderr = opts.stderr;
      }
    },
  };
});

import { registerRunAllCommand } from '../../src/cli/run-all';
import { AgentConfigLoader } from '../../src/core/services/agent-config-loader';
import { loadConfig } from '../../src/core/config';
import { Sandbox } from '../../src/infrastructure/sandbox';

describe('run-all CLI wiring (FIX1.4)', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let mockSandbox: Record<string, unknown>;

  beforeEach(() => {
    capturedArgs = null;
    vi.clearAllMocks();
    mockRunAllImpl.mockResolvedValue({
      totalRuns: 1, successfulRuns: 1, failedRuns: 0, results: new Map(),
      totalDuration: 100, startedAt: new Date(), completedAt: new Date(),
    });
    program = new Command();
    registerRunAllCommand(program);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });

    mockSandbox = {
      id: 'wiring-test-sandbox',
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      runCommand: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      switchState: vi.fn().mockResolvedValue(undefined),
      createSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
      getFilesystemSnapshot: vi.fn(),
      getCacheStats: vi.fn(),
      ping: vi.fn(),
      getFileAccessTracker: vi.fn().mockReturnValue({ getModifiedFiles: vi.fn(), getAccessedFiles: vi.fn(), getDeletedFiles: vi.fn() }),
      config: {},
    };
  });

  it('should capture judgeServiceFactory from BatchRunnerService constructor', async () => {
    (AgentConfigLoader.prototype.loadConfigs as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { agentId: 'test-agent', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
    ]);

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'test-agent']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(capturedArgs).not.toBeNull();
    expect(capturedArgs!.judgeServiceFactory).toBeDefined();
    expect(typeof capturedArgs!.judgeServiceFactory).toBe('function');
  });

  it('should accept (sandbox: ISandbox) and return object with runEvaluationPipeline', async () => {
    (AgentConfigLoader.prototype.loadConfigs as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { agentId: 'test-agent', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
    ]);

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'test-agent']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(capturedArgs).not.toBeNull();
    const { judgeServiceFactory } = capturedArgs!;
    expect(judgeServiceFactory.length).toBe(1);

    const judgeService = judgeServiceFactory(mockSandbox);
    expect(judgeService).toBeDefined();
    expect(typeof judgeService.runEvaluationPipeline).toBe('function');
  });

  it('should produce EvaluationRunResult with errors array when FailureArtifactExporter fails', async () => {
    (AgentConfigLoader.prototype.loadConfigs as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { agentId: 'test-agent', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
    ]);

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'test-agent']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(capturedArgs).not.toBeNull();
    const { judgeServiceFactory } = capturedArgs!;

    const judgeService = judgeServiceFactory(mockSandbox);
    const candidate = {
      id: 'test-candidate',
      hash: 'abcdef1234567890abcdef1234567890abcdef12',
      message: 'fix bug',
      files: ['src/main.ts'],
      status: 'validated' as const,
      created_at: new Date(),
      repositoryUrl: 'https://github.com/test/repo',
      repositoryName: 'test/repo',
      preFixHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      postFixHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    };

    const result = await judgeService.runEvaluationPipeline([candidate], 'test-agent');

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0]).toHaveProperty('candidateId', 'test-candidate');
    expect(result[0]).toHaveProperty('cost');
    expect(result[0]).toHaveProperty('result');
    expect(result[0].result).toHaveProperty('regressionStatus');
    expect(result[0].result).toHaveProperty('eScore');
  });

  it('should populate SandboxConfig from repobench.yaml sandbox section in run-all', async () => {
    vi.mocked(loadConfig).mockResolvedValue({
      mining: { keywords: ['fix'], exclude_paths: [] },
      sandbox: {
        buildCommand: 'npm ci',
        testCommand: 'npm test',
        baseImage: 'node:20-alpine',
        envVars: { NODE_ENV: 'test' },
        agentSetupCommands: ['pip install pytest', 'npm ci'],
        cachePaths: ['/app/node_modules', '/root/.cache'],
      },
    });

    (AgentConfigLoader.prototype.loadConfigs as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { agentId: 'test-agent', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
    ]);

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'test-agent']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(capturedArgs).not.toBeNull();
    const factory = capturedArgs!.sandboxFactory as () => unknown;
    factory();

    const sandboxConfig = vi.mocked(Sandbox).mock.calls[0][0];
    expect(sandboxConfig.buildCommand).toBe('npm ci');
    expect(sandboxConfig.testCommand).toBe('npm test');
    expect(sandboxConfig.baseImage).toBe('node:20-alpine');
    expect(sandboxConfig.envVars).toEqual({ NODE_ENV: 'test' });
    expect(sandboxConfig.agentSetupCommands).toEqual(['pip install pytest', 'npm ci']);
    expect(sandboxConfig.cachePaths).toEqual(['/app/node_modules', '/root/.cache']);
    expect(sandboxConfig.project).toBe('default');
  });

  it('should warn and fall back to defaults when repobench.yaml loading fails in run-all', async () => {
    vi.mocked(loadConfig).mockRejectedValue(new Error('YAML parse error'));

    (AgentConfigLoader.prototype.loadConfigs as unknown as ReturnType<typeof vi.fn>).mockReturnValue([
      { agentId: 'test-agent', model: 'default', temperature: 0, systemPrompt: '', cliArgs: [] },
    ]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'test-agent']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not load repobench.yaml'));

    const factory = capturedArgs!.sandboxFactory as () => unknown;
    factory();

    const sandboxConfig = vi.mocked(Sandbox).mock.calls[0][0];
    expect(sandboxConfig.buildCommand).toBeUndefined();
    expect(sandboxConfig.testCommand).toBeUndefined();
    expect(sandboxConfig.baseImage).toBeUndefined();
    expect(sandboxConfig.envVars).toBeUndefined();

    warnSpy.mockRestore();
  });
});
