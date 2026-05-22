import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitMiner } from '../../../src/core/services/miner';
import { RepoBenchConfig } from '../../../src/core/config';
import { Candidate, ICurationService, ICandidateRepository, ISignificanceFilter, IBenchmarkValidator } from '../../../src/core/contracts';
import simpleGit from 'simple-git';

vi.mock('simple-git');

describe('GitMiner Pipeline Integration', () => {
  let miner: GitMiner;
  let mockGit: any;
  let mockCurationService: ICurationService;
  let mockRepository: ICandidateRepository;
  let mockSignificanceFilter: ISignificanceFilter;
  let mockValidator: IBenchmarkValidator;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGit = {
      log: vi.fn(),
      show: vi.fn().mockResolvedValue('file1.ts'),
    };
    (simpleGit as any).mockReturnValue(mockGit);

    mockCurationService = {
      curate: vi.fn(),
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
      validate: vi.fn().mockResolvedValue({ isValid: true, preFixStatus: 'fail', postFixStatus: 'pass', preFixOutput: '', postFixOutput: '', latency: 100 }),
    };

    miner = new GitMiner(mockRepository, mockSignificanceFilter, mockCurationService, mockValidator);
  });

  it('should include repositoryUrl and repositoryName in candidates', async () => {
    const mockCommits = [{ hash: 'abc12345', message: 'feat: add login' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });
    
    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    
    await miner.mineCommits(config);
    
    expect(mockRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      repositoryUrl: expect.any(String),
      repositoryName: expect.any(String)
    }));
  });

  it('should call curate() and only save if approved', async () => {
    const mockCommits = [{ hash: 'abc12345', message: 'feat: add login' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };

    await miner.mineCommits(config);

    expect(mockCurationService.curate).toHaveBeenCalled();
    expect(mockRepository.upsert).toHaveBeenCalled();
  });

  it('should call curate() and NOT save if not approved', async () => {
    const mockCommits = [{ hash: 'abc12345', message: 'feat: add login' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: false, score: 0, reasoning: 'bad', rawResponse: '' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };

    await miner.mineCommits(config);

    expect(mockCurationService.curate).toHaveBeenCalled();
    expect(mockRepository.upsert).not.toHaveBeenCalled();
  });

  it('should save as validated when validator returns isValid: true', async () => {
    const mockCommits = [{ hash: 'valid123', message: 'feat: valid' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });
    (mockValidator.validate as any).mockResolvedValue({ isValid: true, preFixStatus: 'fail', postFixStatus: 'pass', preFixOutput: '', postFixOutput: '', latency: 100 });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);

    expect(mockValidator.validate).toHaveBeenCalled();
    expect(mockRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      hash: 'valid123',
      status: 'validated'
    }));
  });

  it('should save as rejected when validator returns isValid: false', async () => {
    const mockCommits = [{ hash: 'invalid123', message: 'feat: invalid' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });
    (mockValidator.validate as any).mockResolvedValue({ isValid: false, preFixStatus: 'fail', postFixStatus: 'fail', preFixOutput: '', postFixOutput: '', latency: 100 });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);

    expect(mockValidator.validate).toHaveBeenCalled();
    expect(mockRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      hash: 'invalid123',
      status: 'rejected'
    }));
  });

  it('should NOT call validator when curation rejects the candidate', async () => {
    const mockCommits = [{ hash: 'rejected123', message: 'feat: rejected' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: false, score: 0, reasoning: 'bad', rawResponse: '' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);

    expect(mockValidator.validate).not.toHaveBeenCalled();
  });

  it('should save candidate with postFixHash matching commit hash through pipeline', async () => {
    const mockCommits = [{ hash: 'abc12345', message: 'feat: test' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.raw = vi.fn().mockResolvedValue('parent123\n');
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);

    expect(mockRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      hash: 'abc12345',
      postFixHash: 'abc12345',
    }));
  });

  it('should save candidate with preFixHash from git rev-parse through pipeline', async () => {
    const mockCommits = [{ hash: 'def67890', message: 'fix: bug' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.raw = vi.fn().mockResolvedValue('parent999\n');
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);

    expect(mockRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      hash: 'def67890',
      preFixHash: 'parent999',
    }));
    expect(mockGit.raw).toHaveBeenCalledWith(['rev-parse', 'def67890^']);
  });

  it('should save candidate with preFixHash undefined for root commits through pipeline', async () => {
    const mockCommits = [{ hash: 'root00001', message: 'initial commit' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.raw = vi.fn().mockRejectedValue(new Error('fatal: ambiguous argument'));
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good', rawResponse: '' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };
    await miner.mineCommits(config);

    expect(mockRepository.upsert).toHaveBeenCalledWith(expect.objectContaining({
      hash: 'root00001',
      preFixHash: undefined,
    }));
  });
});
