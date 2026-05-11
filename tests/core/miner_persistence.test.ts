import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Miner } from '../../src/core/miner';
import { ICandidateRepository, CommitCandidate } from '../../src/types/contracts';
import { RepoBenchConfig } from '../../src/core/config';
import simpleGit from 'simple-git';

vi.mock('simple-git');

describe('Miner Persistence', () => {
  let mockRepo: ICandidateRepository;
  let mockGit: any;
  let config: RepoBenchConfig;
  let miner: Miner;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      saveMany: vi.fn().mockResolvedValue(undefined),
      findAll: vi.fn().mockResolvedValue([]),
      findByStatus: vi.fn().mockResolvedValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGit = {
      log: vi.fn().mockResolvedValue({
        all: [
          { hash: 'abc123', message: 'fix: bug in engine', body: '', author: {} as any, date: '' }
        ]
      }),
      show: vi.fn().mockImplementation((args: any[]) => {
        if (args.includes('--name-only')) {
          return Promise.resolve('file1.ts\nfile1.test.ts');
        }
        return Promise.resolve('+ const x = 1;');
      }),
    };

    (simpleGit as any).mockReturnValue(mockGit);

    config = {
      mining: {
        keywords: ['fix'],
        exclude_paths: [],
        source_extensions: ['ts', 'js'],
      },
    } as any;

    // @ts-ignore - Miner constructor will be updated to accept repo
    miner = new Miner('/fake/path', config, mockRepo);
  });

  it('should return cached candidates if they exist in the repository', async () => {
    const cachedCandidates: CommitCandidate[] = [
      { hash: 'cached1', message: 'cached fix', files: ['f1.ts'], status: 'pending' }
    ];
    mockRepo.findAll.mockResolvedValue(cachedCandidates);
    mockGit.log.mockResolvedValue({
      all: []
    });

    const results = await miner.mineCommits();

    expect(results).toEqual(cachedCandidates);
    expect(mockGit.log).toHaveBeenCalled();
  });

  it('should mine from git and save to repository if no candidates exist', async () => {
    mockRepo.findAll.mockResolvedValue([]);
    
    const results = await miner.mineCommits();

    expect(results.length).toBeGreaterThan(0);
    expect(mockGit.log).toHaveBeenCalled();
    expect(mockRepo.saveMany).toHaveBeenCalledWith(results);
  });

  it('should identify candidates even when keywords list is empty', async () => {
    miner = new Miner('/fake/path', {
      ...config,
      mining: { ...config.mining, keywords: [] }
    }, mockRepo);
    mockRepo.findAll.mockResolvedValue([]);

    const results = await miner.mineCommits();

    expect(results.length).toBeGreaterThan(0);
  });

  it('should discover new commits and merge them with cached ones', async () => {
    const cachedCandidates: CommitCandidate[] = [
      { hash: 'cached1', message: 'cached fix', files: ['f1.ts'], status: 'pending' }
    ];
    mockRepo.findAll.mockResolvedValue(cachedCandidates);
    
    mockGit.log.mockResolvedValue({
      all: [
        { hash: 'abc123', message: 'fix: bug in engine', body: '', author: {} as any, date: '' }
      ]
    });

    const results = await miner.mineCommits();

    expect(results.length).toBe(2);
    expect(results).toContainEqual(expect.objectContaining({ hash: 'cached1' }));
    expect(results).toContainEqual(expect.objectContaining({ hash: 'abc123' }));
    expect(mockRepo.saveMany).toHaveBeenCalledWith([expect.objectContaining({ hash: 'abc123' })]);
  });

  it('should not re-process commits that are already in the repository', async () => {
    const cachedCandidates: CommitCandidate[] = [
      { hash: 'abc123', message: 'fix: bug in engine', files: ['f1.ts'], status: 'pending' }
    ];
    mockRepo.findAll.mockResolvedValue(cachedCandidates);
    
    mockGit.log.mockResolvedValue({
      all: [
        { hash: 'abc123', message: 'fix: bug in engine', body: '', author: {} as any, date: '' }
      ]
    });

    await miner.mineCommits();

    expect(mockGit.show).not.toHaveBeenCalled();
  });
});
