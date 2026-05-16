import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitMiner } from '../../../src/core/services/miner';
import { RepoBenchConfig } from '../../../src/core/config';
import { ICurationService, ICandidateRepository, ISignificanceFilter, IBenchmarkValidator } from '../../../src/core/contracts';
import simpleGit from 'simple-git';

vi.mock('simple-git');

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

    mockGit = {
      log: vi.fn(),
      show: vi.fn().mockResolvedValue('file1.ts'),
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

  const setupCommit = (hash: string) => {
    mockGit.log.mockResolvedValue({ all: [{ hash, message: 'feat: test', body: '', author_name: '', author_email: '', date: '' }] });
  };

  it('should log success when validator returns isValid: true (Pre-fail, Post-pass)', async () => {
    const hash = 'success123';
    setupCommit(hash);
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
    setupCommit(hash);
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
    setupCommit(hash);
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
    setupCommit(hash);
    mockValidator.validate.mockRejectedValue(new Error('Sandbox crash'));

    await runMiner();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`REJECTED: Sandbox error`));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(hash));
  });
});
