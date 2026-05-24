import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerEvaluateCommand } from '../../src/cli/evaluate';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { Evaluator } from '../../src/core/services/evaluator';
import { JudgeService } from '../../src/core/services/judge-service';
import { loadConfig } from '../../src/core/config';

vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/infrastructure/sandbox');
vi.mock('../../src/core/services/evaluator');
vi.mock('../../src/core/services/judge-service');
vi.mock('../../src/core/config');

describe('CLI: repobench evaluate', () => {
  let program: Command;
  let consoleLogSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const configModule = await import('../../src/core/config');
    vi.mocked(configModule.resolveDatabasePath).mockReturnValue('/tmp/evaluate-test/repobench.db');
    program = new Command();
    registerEvaluateCommand(program);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should report results for each candidate in the correct format', async () => {
    const mockCandidates = [
      { id: 'cand-1', status: 'validated' },
      { id: 'cand-2', status: 'validated' },
    ];
    (CandidateRepository.prototype.getAll as any).mockReturnValue(mockCandidates);

    const mockResults = [
      { candidateId: 'cand-1', result: { regressionStatus: 'clean', message: 'All tests passed' } },
      { candidateId: 'cand-2', result: { regressionStatus: 'regressed', message: 'Test X failed' } },
    ];
    (JudgeService.prototype.runEvaluationPipeline as any).mockResolvedValue(mockResults);
    (Sandbox.prototype.init as any).mockResolvedValue(undefined);
    (Sandbox.prototype.destroy as any).mockResolvedValue(undefined);

    await program.parseAsync(['node', 'repobench', 'evaluate']);

    expect(consoleLogSpy).toHaveBeenCalledWith('Evaluation complete: 2 candidate(s) processed.');
    expect(consoleLogSpy).toHaveBeenCalledWith('  cand-1: clean - All tests passed');
    expect(consoleLogSpy).toHaveBeenCalledWith('  cand-2: regressed - Test X failed');
  });

  it('should handle candidates with missing hashes by showing error status in CLI', async () => {
    const mockCandidates = [{ id: 'cand-invalid', status: 'validated' }];
    (CandidateRepository.prototype.getAll as any).mockReturnValue(mockCandidates);

    const mockResults = [
      { candidateId: 'cand-invalid', result: { regressionStatus: 'error', message: 'Missing preFixHash' } },
    ];
    (JudgeService.prototype.runEvaluationPipeline as any).mockResolvedValue(mockResults);
    (Sandbox.prototype.init as any).mockResolvedValue(undefined);
    (Sandbox.prototype.destroy as any).mockResolvedValue(undefined);

    await program.parseAsync(['node', 'repobench', 'evaluate']);

    expect(consoleLogSpy).toHaveBeenCalledWith('  cand-invalid: error - Missing preFixHash');
  });

  it('should show a message when no validated candidates are found', async () => {
    (CandidateRepository.prototype.getAll as any).mockReturnValue([]);

    await program.parseAsync(['node', 'repobench', 'evaluate']);

    expect(consoleLogSpy).toHaveBeenCalledWith('No validated candidates found to evaluate.');
  });

  it('should process pending candidates instead of skipping them', async () => {
    const mockCandidates = [
      { id: 'cand-p1', status: 'pending' },
    ];
    (CandidateRepository.prototype.getAll as any).mockReturnValue(mockCandidates);

    const mockResults = [
      { candidateId: 'cand-p1', result: { regressionStatus: 'clean', message: 'All tests passed' } },
    ];
    (JudgeService.prototype.runEvaluationPipeline as any).mockResolvedValue(mockResults);
    (Sandbox.prototype.init as any).mockResolvedValue(undefined);
    (Sandbox.prototype.destroy as any).mockResolvedValue(undefined);

    await program.parseAsync(['node', 'repobench', 'evaluate']);

    expect(consoleLogSpy).toHaveBeenCalledWith('Evaluation complete: 1 candidate(s) processed.');
  });

  it('should report proper error messages when judge service fails', async () => {
    (CandidateRepository.prototype.getAll as any).mockReturnValue([{ id: 'cand-1', status: 'validated' }]);
    (JudgeService.prototype.runEvaluationPipeline as any).mockRejectedValue(new Error('Sandbox failure'));
    (Sandbox.prototype.init as any).mockResolvedValue(undefined);
    (Sandbox.prototype.destroy as any).mockResolvedValue(undefined);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // The action calls process.exit(1) on error. We need to mock it to prevent test from exiting.
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });

    try {
      await program.parseAsync(['node', 'repobench', 'evaluate']);
    } catch (e) {
      // Expected process.exit error
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Evaluation error: Sandbox failure'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    consoleErrorSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should populate SandboxConfig buildCommand testCommand baseImage envVars agentSetupCommands and cachePaths from repobench.yaml', async () => {
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

    const mockCandidates = [{ id: 'cand-1', status: 'validated' }];
    (CandidateRepository.prototype.getAll as any).mockReturnValue(mockCandidates);
    (JudgeService.prototype.runEvaluationPipeline as any).mockResolvedValue([]);
    (Sandbox.prototype.init as any).mockResolvedValue(undefined);
    (Sandbox.prototype.destroy as any).mockResolvedValue(undefined);

    await program.parseAsync(['node', 'repobench', 'evaluate']);

    const sandboxConfig = vi.mocked(Sandbox).mock.calls[0][0];
    expect(sandboxConfig.buildCommand).toBe('npm ci');
    expect(sandboxConfig.testCommand).toBe('npm test');
    expect(sandboxConfig.baseImage).toBe('node:20-alpine');
    expect(sandboxConfig.envVars).toEqual({ NODE_ENV: 'test' });
    expect(sandboxConfig.agentSetupCommands).toEqual(['pip install pytest', 'npm ci']);
    expect(sandboxConfig.cachePaths).toEqual(['/app/node_modules', '/root/.cache']);
    expect(sandboxConfig.project).toBe('default');
  });

  it('should warn and fall back to defaults when repobench.yaml loading fails', async () => {
    vi.mocked(loadConfig).mockRejectedValue(new Error('YAML parse error'));

    const mockCandidates = [{ id: 'cand-1', status: 'validated' }];
    (CandidateRepository.prototype.getAll as any).mockReturnValue(mockCandidates);
    (JudgeService.prototype.runEvaluationPipeline as any).mockResolvedValue([]);
    (Sandbox.prototype.init as any).mockResolvedValue(undefined);
    (Sandbox.prototype.destroy as any).mockResolvedValue(undefined);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await program.parseAsync(['node', 'repobench', 'evaluate']);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not load repobench.yaml'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('YAML parse error'));

    const sandboxConfig = vi.mocked(Sandbox).mock.calls[0][0];
    expect(sandboxConfig.buildCommand).toBeUndefined();
    expect(sandboxConfig.testCommand).toBeUndefined();
    expect(sandboxConfig.baseImage).toBeUndefined();
    expect(sandboxConfig.envVars).toBeUndefined();

    warnSpy.mockRestore();
  });
});
