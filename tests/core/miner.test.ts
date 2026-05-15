import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitMiner } from '../../src/core/services/miner';
import { RepoBenchConfig } from '../../src/core/config';
import { Candidate } from '../../src/core/contracts';
import simpleGit from 'simple-git';

vi.mock('simple-git');

describe('GitMiner', () => {
  let miner: GitMiner;
  let mockGit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockGit = {
      log: vi.fn(),
      show: vi.fn().mockResolvedValue(''),
    };

    
    (simpleGit as any).mockReturnValue(mockGit);
    miner = new GitMiner();
  });

  it('should return a list of Candidates from git history', async () => {
    const mockCommits = [
      {
        hash: 'abc12345',
        message: 'feat: add login',
        body: '',
        author_name: 'John Doe',
        date: new Date(),
      },
      {
        hash: 'def67890',
        message: 'fix: bug in auth',
        body: '',
        author_name: 'Jane Doe',
        date: new Date(),
      }
    ];

    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    // We also need to mock the files part of the commit. 
    // In simple-git, you might need to call show or use log options.
    // Let's assume GitMiner handles getting files.
    // For the sake of the test, let's assume GitMiner uses some method to get files per commit.
    // Actually, simple-git's log can be configured to return files if you use the right options.
    
    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: [],
        since: undefined,
        limit: undefined,
      }
    };

    const candidates = await miner.mineCommits(config);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toHaveProperty('id');
    expect(candidates[0].hash).toBe('abc12345');
    expect(candidates[0].message).toBe('feat: add login');
    expect(Array.isArray(candidates[0].files)).toBe(true);
  });

  it('should respect the limit parameter from config', async () => {
    const mockCommits = [
      { hash: '1', message: 'm1' },
      { hash: '2', message: 'm2' },
      { hash: '3', message: 'm3' },
    ];
    mockGit.log.mockResolvedValue({ all: mockCommits });

    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: [],
        since: undefined,
        limit: 2,
      }
    };

    await miner.mineCommits(config);

    expect(mockGit.log).toHaveBeenCalledWith(expect.objectContaining({
      maxCount: 2
    }));
  });

  it('should respect the since parameter from config', async () => {
    mockGit.log.mockResolvedValue({ all: [] });
    const sinceDate = '2023-01-01T00:00:00Z';
    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: [],
        since: sinceDate,
        limit: undefined,
      }
    };

    await miner.mineCommits(config);

    expect(mockGit.log).toHaveBeenCalledWith(expect.objectContaining({
      from: sinceDate
    }));
  });

  it('should correctly map commit data to Candidate type', async () => {
    const mockCommits = [
      {
        hash: 'hash123',
        message: 'commit message 1',
      }
    ];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    // We might need to mock the way files are retrieved. 
    // If GitMiner uses git.show(['--name-only', hash]), we should mock that.
    mockGit.show = vi.fn().mockResolvedValue('file1.ts\nfile2.ts');

    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: [],
        since: undefined,
        limit: undefined,
      }
    };

    const candidates = await miner.mineCommits(config);
    const candidate = candidates[0];

    expect(candidate.hash).toBe('hash123');
    expect(candidate.message).toBe('commit message 1');
    expect(candidate.files).toEqual(['file1.ts', 'file2.ts']);
  });

  it('should throw descriptive error when git.log fails', async () => {
    mockGit.log.mockRejectedValue(new Error('Git error'));
    
    const config: RepoBenchConfig = {
      mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined }
    };
    
    await expect(miner.mineCommits(config)).rejects.toThrow('Failed to fetch git log: Git error');
  });


  it('should skip commits that fail to retrieve files via git.show', async () => {
    const mockCommits = [
      { hash: 'good', message: 'm1' },
      { hash: 'bad', message: 'm2' },
    ];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    
    mockGit.show = vi.fn()
      .mockResolvedValueOnce('file1.ts')
      .mockRejectedValueOnce(new Error('Show error'));
    
    const config: RepoBenchConfig = {
      mining: { keywords: [], exclude_paths: [], since: undefined, limit: undefined }
    };
    
    const candidates = await miner.mineCommits(config);
    
    expect(candidates).toHaveLength(1);
    expect(candidates[0].hash).toBe('good');
  });

  it('should filter commits by keywords (case-insensitive)', async () => {
    const mockCommits = [
      { hash: '1', message: 'Fix bug in auth' },
      { hash: '2', message: 'Add new feature' },
      { hash: '3', message: 'FIX: minor typo' },
    ];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.show = vi.fn().mockResolvedValue('file.ts');

    const config: RepoBenchConfig = {
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
        since: undefined,
        limit: undefined,
      }
    };

    const candidates = await miner.mineCommits(config);
    
    expect(candidates).toHaveLength(2);
    expect(candidates.map(c => c.hash)).toContain('1');
    expect(candidates.map(c => c.hash)).toContain('3');
    expect(candidates.map(c => c.hash)).not.toContain('2');
  });

  it('should keep all commits if keywords list is empty', async () => {
    const mockCommits = [
      { hash: '1', message: 'm1' },
      { hash: '2', message: 'm2' },
    ];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.show = vi.fn().mockResolvedValue('file.ts');

    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: [],
        since: undefined,
        limit: undefined,
      }
    };

    const candidates = await miner.mineCommits(config);
    expect(candidates).toHaveLength(2);
  });

  it('should discard commit if all files match exclude_paths', async () => {
    const mockCommits = [{ hash: '1', message: 'm1' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.show = vi.fn().mockResolvedValue('tests/unit.test.ts\n.github/workflow.yml');

    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: ['tests/', '.github/'],
        since: undefined,
        limit: undefined,
      }
    };

    const candidates = await miner.mineCommits(config);
    expect(candidates).toHaveLength(0);
  });

  it('should keep commit if at least one file does not match exclude_paths', async () => {
    const mockCommits = [{ hash: '1', message: 'm1' }];
    mockGit.log.mockResolvedValue({ all: mockCommits });
    mockGit.show = vi.fn().mockResolvedValue('src/core/miner.ts\ntests/unit.test.ts');

    const config: RepoBenchConfig = {
      mining: {
        keywords: [],
        exclude_paths: ['tests/'],
        since: undefined,
        limit: undefined,
      }
    };

    const candidates = await miner.mineCommits(config);
    expect(candidates).toHaveLength(1);
  });
});
