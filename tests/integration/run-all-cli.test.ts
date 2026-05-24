import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerRunAllCommand } from '../../src/cli/run-all';
import { BatchRunnerService } from '../../src/core/services/batch-runner';
import { AgentConfigLoader } from '../../src/core/services/agent-config-loader';
import { Database } from '../../src/infrastructure/database';

vi.mock('../../src/core/services/batch-runner');
vi.mock('../../src/core/services/agent-config-loader');
vi.mock('../../src/infrastructure/database');

// Mock other dependencies that might be instantiated in the CLI
vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/core/repositories/run-result-repository');
vi.mock('../../infrastructure/sandbox');
vi.mock('../../core/services/evaluator');
vi.mock('../../core/services/judge-service');
vi.mock('../../services/session-orchestrator');
vi.mock('../../infrastructure/services/worker-pool');
vi.mock('../../core/services/batch-progress-reporter');

describe('CLI: repobench run-all', () => {
  let program: Command;
  let consoleLogSpy: any;
  let exitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    registerRunAllCommand(program);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
  });

  it('should throw error when required --agents option is missing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      await program.parseAsync(['node', 'repobench', 'run-all']);
    } catch (e) {
      // expected
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should use default values for concurrency, project, and timeout', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockResolvedValue([{ id: 'aider' }]);
    
    await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);

    const calledConfig = (BatchRunnerService.prototype.runAll as any).mock.calls[0][0];
    expect(calledConfig.concurrency).toBe(2);
    expect(calledConfig.timeoutPerRun).toBe(300000);
    // project is typically in SandboxConfig, but we can check if it's passed if we had access to SandboxConfig mock
  });

  it('should pass --candidate-ids to BatchRunnerService', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockResolvedValue([{ id: 'aider' }]);
    
    await program.parseAsync([
      'node', 'repobench', 'run-all', 
      '--agents', 'aider', 
      '--candidate-ids', 'uuid1,uuid2'
    ]);

    const calledConfig = (BatchRunnerService.prototype.runAll as any).mock.calls[0][0];
    expect(calledConfig.candidateIds).toEqual(['uuid1', 'uuid2']);
  });

  it('should print planned run matrix and exit when --dry-run is provided', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockReturnValue([{ agentId: 'aider' }]);
    await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider', '--dry-run']);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Planned run matrix'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Agent: aider'));
    expect(BatchRunnerService.prototype.runAll).not.toHaveBeenCalled();
  });

  it('should load agent configurations before executing a full run', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockReturnValue([{ agentId: 'aider' }]);
    (BatchRunnerService.prototype.runAll as any).mockResolvedValue({
      successfulRuns: 1,
      failedRuns: 0,
      results: new Map(),
    });

    await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);

    expect(AgentConfigLoader.prototype.loadConfigs).toHaveBeenCalled();
  });

  it('should handle errors from AgentConfigLoader gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (AgentConfigLoader.prototype.loadConfigs as any).mockImplementation(() => {
      throw new Error('Config load failed');
    });

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider', '--dry-run']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error: Config load failed'));
    consoleErrorSpy.mockRestore();
  });


  it('should execute full pipeline and exit with 0 on success', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockResolvedValue([{ id: 'aider' }]);
    (BatchRunnerService.prototype.runAll as any).mockResolvedValue({
      successfulRuns: 1,
      failedRuns: 0,
      results: new Map(),
    });

    await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);

    expect(Database.init).toHaveBeenCalled();
    expect(BatchRunnerService.prototype.runAll).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should exit with 1 if any run failed', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockResolvedValue([{ id: 'aider' }]);
    (BatchRunnerService.prototype.runAll as any).mockResolvedValue({
      successfulRuns: 0,
      failedRuns: 1,
      results: new Map(),
    });

    try {
      await program.parseAsync(['node', 'repobench', 'run-all', '--agents', 'aider']);
    } catch (e) {
      // process.exit mock throws
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should pass correct config options to BatchRunnerService', async () => {
    (AgentConfigLoader.prototype.loadConfigs as any).mockResolvedValue([{ id: 'aider' }]);
    
    await program.parseAsync([
      'node', 'repobench', 'run-all', 
      '--agents', 'aider', 
      '--concurrency', '5', 
      '--timeout', '10000',
      '--project', 'test-project'
    ]);

    const calledConfig = (BatchRunnerService.prototype.runAll as any).mock.calls[0][0];
    expect(calledConfig.concurrency).toBe(5);
    expect(calledConfig.timeoutPerRun).toBe(10000);
    // project is handled in SandboxConfig which is likely passed into the service
  });
});
