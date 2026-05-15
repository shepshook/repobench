import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitMiner } from '../../../src/core/services/miner';
import { RepoBenchConfig } from '../../../src/core/config';
import { Candidate, ICurationService, ICandidateRepository, ISignificanceFilter } from '../../../src/core/contracts';
import simpleGit from 'simple-git';

vi.mock('simple-git');

describe('GitMiner Curation', () => {
  let miner: GitMiner;
  let mockGit: any;
  let mockCurationService: ICurationService;
  let mockRepository: ICandidateRepository;
  let mockSignificanceFilter: ISignificanceFilter;

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
      exists: vi.fn().mockReturnValue(false),
      getAll: vi.fn().mockReturnValue([]),
    };

    mockSignificanceFilter = {
      isSignificant: vi.fn().mockResolvedValue(true),
    };

    miner = new GitMiner(mockRepository, mockSignificanceFilter, mockCurationService);
  });

  it('should call curate() and only save if approved', async () => {
    const mockCommits = [{ hash: 'abc12345', message: 'feat: add login' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    // Test approved
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: true, score: 1, reasoning: 'good' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };

    await miner.mineCommits(config);

    expect(mockCurationService.curate).toHaveBeenCalled();
    expect(mockRepository.save).toHaveBeenCalled();
  });

  it('should call curate() and NOT save if not approved', async () => {
    const mockCommits = [{ hash: 'abc12345', message: 'feat: add login' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    // Test rejected
    (mockCurationService.curate as any).mockResolvedValue({ isApproved: false, score: 0, reasoning: 'bad' });

    const config: RepoBenchConfig = { mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined } };

    await miner.mineCommits(config);

    expect(mockCurationService.curate).toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
