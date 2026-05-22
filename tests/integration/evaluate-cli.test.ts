import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerEvaluateCommand } from '../../src/cli/evaluate';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { Evaluator } from '../../src/core/services/evaluator';
import { JudgeService } from '../../src/core/services/judge-service';

vi.mock('../../src/core/repositories/candidate-repository');
vi.mock('../../src/infrastructure/sandbox');
vi.mock('../../src/core/services/evaluator');
vi.mock('../../src/core/services/judge-service');

describe('CLI: repobench evaluate', () => {
  let program: Command;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
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
});
