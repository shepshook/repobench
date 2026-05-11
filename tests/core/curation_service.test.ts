import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CurationService } from '../../src/core/curation/service';
import { LLMClient } from '../../src/core/llm/client';
import { ICandidateRepository, CommitCandidate } from '../../types/contracts';
import { RepoBenchConfig } from '../../src/core/config';

describe('CurationService', () => {
  let curationService: CurationService;
  let mockLlmClient: any;
  let mockRepo: any;
  let mockGit: any;

  beforeEach(() => {
    mockLlmClient = {
      chat: vi.fn(),
    };

    mockRepo = {
      findByStatus: vi.fn(),
      updateStatuses: vi.fn(),
      findAll: vi.fn(),
      findByHashes: vi.fn(),
    };

    mockGit = {
      show: vi.fn().mockResolvedValue('diff content'),
    };

    curationService = new CurationService(mockLlmClient, mockRepo, mockGit);
  });

  it('should return empty array if no pending candidates exist', async () => {
    mockRepo.findByStatus.mockResolvedValue([]);
    const result = await curationService.curate(10);
    expect(result).toEqual([]);
    expect(mockLlmClient.chat).not.toHaveBeenCalled();
  });

  it('should correctly mark selected candidates as validated and others as rejected', async () => {
    const candidates: CommitCandidate[] = [
      { hash: 'h1', message: 'm1', files: ['f1.ts'], status: 'pending' },
      { hash: 'h2', message: 'm2', files: ['f2.ts'], status: 'pending' },
      { hash: 'h3', message: 'm3', files: ['f3.ts'], status: 'pending' },
    ];
    mockRepo.findByStatus.mockResolvedValue(candidates);
    mockLlmClient.chat.mockResolvedValue('["h1", "h3"]');
    mockRepo.findByHashes.mockResolvedValue([
      { hash: 'h1', message: 'm1', files: ['f1.ts'], status: 'validated' },
      { hash: 'h3', message: 'm3', files: ['f3.ts'], status: 'validated' },
    ]);

    const result = await curationService.curate(2);

    expect(result).toHaveLength(2);
    expect(result.map(c => c.hash)).toContain('h1');
    expect(result.map(c => c.hash)).toContain('h3');
    expect(mockRepo.updateStatuses).toHaveBeenCalledWith(expect.arrayContaining([
      { hash: 'h1', status: 'validated' },
      { hash: 'h2', status: 'rejected' },
      { hash: 'h3', status: 'validated' },
    ]));
  });

  it('should handle malformed LLM response gracefully', async () => {
    const candidates: CommitCandidate[] = [
      { hash: 'h1', message: 'm1', files: ['f1.ts'], status: 'pending' },
    ];
    mockRepo.findByStatus.mockResolvedValue(candidates);
    mockLlmClient.chat.mockResolvedValue('Not a JSON array');
    mockRepo.findByHashes.mockResolvedValue([]);

    const result = await curationService.curate(10);

    expect(result).toEqual([]);
    expect(mockRepo.updateStatuses).toHaveBeenCalledWith(expect.arrayContaining([
      { hash: 'h1', status: 'rejected' },
    ]));
  });

  it('should respect the limit', async () => {
    const candidates: CommitCandidate[] = [
      { hash: 'h1', message: 'm1', files: ['f1.ts'], status: 'pending' },
      { hash: 'h2', message: 'm2', files: ['f2.ts'], status: 'pending' },
      { hash: 'h3', message: 'm3', files: ['f3.ts'], status: 'pending' },
    ];
    mockRepo.findByStatus.mockResolvedValue(candidates);
    mockLlmClient.chat.mockResolvedValue('["h1", "h2", "h3"]');
    mockRepo.findByHashes.mockResolvedValue([
      { hash: 'h1', message: 'm1', files: ['f1.ts'], status: 'validated' },
      { hash: 'h2', message: 'm2', files: ['f2.ts'], status: 'validated' },
    ]);

    const result = await curationService.curate(2);

    expect(result).toHaveLength(2);
  });
});
