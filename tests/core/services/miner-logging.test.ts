import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitMiner } from '../../../src/core/services/miner';
import { RepoBenchConfig } from '../../../src/core/config';
import { ICurationService, ICandidateRepository, ISignificanceFilter, IBenchmarkValidator } from '../../../src/core/contracts';
import simpleGit from 'simple-git';
import { execFile } from 'node:child_process';

vi.mock('simple-git');
vi.mock('node:child_process');

function mockExecFileCommits(commits: { hash: string; message: string }[]): void {
  const stdout = commits.map(c => `${c.hash}|2024-01-01 12:00:00 +0000|${c.message}`).join('\n') + '\n';
  (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      cb(null, stdout, '');
      return { on: vi.fn(), kill: vi.fn() };
    }
  );
}

describe('GitMiner Logging (Task 1.5.4)', () => {
  let miner: GitMiner;
  let mockGit: any;
  let mockCurationService: ICurationService;
  let mockRepository: ICandidateRepository;
  let mockSignificanceFilter: ISignificanceFilter;
  let mockValidator: IBenchmarkValidator;
  let logSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockExecFileCommits([{ hash: 'test-hash', message: 'test commit' }]);

    mockGit = {
      show: vi.fn().mockResolvedValue('file1.ts'),
      raw: vi.fn().mockResolvedValue('parent-hash\n'),
    };
    (simpleGit as any).mockReturnValue(mockGit);

    mockCurationService = {
      curate: vi.fn().mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' }),
    };

    mockRepository = {
      save: vi.fn(),
      upsert: vi.fn((c) => mockRepository.save(c)),
      exists: vi.fn().mockReturnValue(false),
      existsById: vi.fn().mockReturnValue(false),
      getById: vi.fn(),
      getAll: vi.fn().mockReturnValue([]),
    };

    mockSignificanceFilter = {
      isSignificant: vi.fn().mockResolvedValue(true),
    };

    mockValidator = {
      validate: vi.fn(),
    };

    miner = new GitMiner(mockRepository, mockSignificanceFilter, mockCurationService, mockValidator);
  });

  const runMiner = async () => {
    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);
  };

  // === Task 1.8.FIX1: execFile Mock Infrastructure Verification ===
  // These tests verify the mock is set up per the Technical Directive.
  // They FAIL with the current code and PASS once the fix is applied.

  it('[FIX1] should set up execFile mock implementation in beforeEach', () => {
    const mockFn = execFile as unknown as ReturnType<typeof vi.fn>;
    const cb = vi.fn();
    mockFn('git', ['log'], {}, cb);
    expect(cb).toHaveBeenCalled();
  });

  it('[FIX1] should return child process object with .on() and .kill() from execFile mock', async () => {
    mockExecFileCommits([{ hash: 'obj123', message: 'feat: child test' }]);
    mockValidator.validate.mockResolvedValue({
      isValid: true,
      preFixStatus: 'fail',
      postFixStatus: 'pass',
      preFixOutput: '',
      postFixOutput: '',
      latency: 0
    });

    await runMiner();

    const mockFn = execFile as unknown as ReturnType<typeof vi.fn>;
    expect(mockFn.mock.calls.length).toBeGreaterThan(0);
    const child = mockFn.mock.results[0]?.value;
    expect(child).toBeDefined();
    expect(typeof child.on).toBe('function');
    expect(typeof child.kill).toBe('function');
  });

  it('should log success when validator returns isValid: true (Pre-fail, Post-pass)', async () => {
    const hash = 'success123';
    mockExecFileCommits([{ hash, message: 'feat: test' }]);
    mockValidator.validate.mockResolvedValue({
      isValid: true,
      preFixStatus: 'fail',
      postFixStatus: 'pass',
      preFixOutput: 'pre fail output',
      postFixOutput: 'post pass output',
      latency: 123
    });

    await runMiner();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`VALIDATED: Pre-fail, Post-pass`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(hash));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('123ms'));
  });

  it('should log False Positive when validator returns preFixStatus: pass', async () => {
    const hash = 'fp123';
    mockExecFileCommits([{ hash, message: 'feat: test' }]);
    mockValidator.validate.mockResolvedValue({
      isValid: false,
      preFixStatus: 'pass',
      postFixStatus: 'pass',
      preFixOutput: 'pre pass output',
      postFixOutput: 'post pass output',
      latency: 456
    });

    await runMiner();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`REJECTED: Pre-pass`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(hash));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('456ms'));
    // RCA requirements: log raw stdout/stderr
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('pre pass output'));
  });

  it('should log Failed Fix when validator returns preFixStatus: fail and postFixStatus: fail', async () => {
    const hash = 'ff123';
    mockExecFileCommits([{ hash, message: 'feat: test' }]);
    mockValidator.validate.mockResolvedValue({
      isValid: false,
      preFixStatus: 'fail',
      postFixStatus: 'fail',
      preFixOutput: 'pre fail output',
      postFixOutput: 'post fail output',
      latency: 789
    });

    await runMiner();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`REJECTED: Post-fail`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(hash));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('789ms'));
    // RCA requirements: log raw stdout/stderr
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('post fail output'));
  });

  it('should log Sandbox error when validator throws an error', async () => {
    const hash = 'err123';
    mockExecFileCommits([{ hash, message: 'feat: test' }]);
    mockValidator.validate.mockRejectedValue(new Error('Sandbox crash'));

    await runMiner();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`REJECTED: Sandbox error`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(hash));
  });
});
