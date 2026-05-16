import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { ICandidateRepository, Candidate } from '../../src/core/contracts';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

vi.mock('node:fs/promises');

describe('JsonlDatasetImporter', () => {
  let mockRepo: ICandidateRepository;
  let importer: JsonlDatasetImporter;
  let tempFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRepo = {
      save: vi.fn(),
      upsert: vi.fn(),
      exists: vi.fn(),
      existsById: vi.fn(),
      getById: vi.fn(),
      getAll: vi.fn(),
    };

    // @ts-ignore - class doesn't exist yet
    importer = new JsonlDatasetImporter(mockRepo);
    tempFile = path.join(os.tmpdir(), 'test-import.jsonl');
  });

  it('should correctly import valid candidates from a JSONL file', async () => {
    const id1 = generateValidUuid();
    const id2 = generateValidUuid();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id1, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/user/repo2', name: 'repo2' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.8, reasoning: 'Okay', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id2, createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await importer.import(tempFile);

    expect(mockRepo.upsert).toHaveBeenCalledTimes(2);
    const firstCallArg = mockRepo.upsert.mock.calls[0][0] as Candidate;
    expect(firstCallArg.id).toBe(id1);
    expect(firstCallArg.repositoryUrl).toBe('https://github.com/user/repo1');
  });

  it('should correctly map repositoryUrl from imported JSONL', async () => {
    const id = generateValidUuid();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo-test', name: 'repo-test' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await importer.import(tempFile);

    const upsertedCandidate = mockRepo.upsert.mock.calls[0][0] as Candidate;
    expect(upsertedCandidate.repositoryUrl).toBe('https://github.com/user/repo-test');
    expect(upsertedCandidate.repositoryUrl).not.toBeUndefined();
  });

  it('should update existing candidates when importing (upsert)', async () => {
    const id = generateValidUuid();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await importer.import(tempFile);
    expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
    
    const updatedData = [
      {
        ...mockData[0],
        curation: { score: 0.95, reasoning: 'Better', isApproved: true },
      },
    ];
    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(
      updatedData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(true);

    await importer.import(tempFile);
    expect(mockRepo.upsert).toHaveBeenCalledTimes(2);
    const lastCallArg = mockRepo.upsert.mock.calls[1][0] as Candidate;
    expect(lastCallArg.curation?.score).toBe(0.95);
    expect(lastCallArg.curation?.reasoning).toBe('Better');
  });

  it('should not import duplicate candidates present in the same file', async () => {
    const id = generateValidUuid();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await importer.import(tempFile);

    expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
  });


  it('should throw an error when the JSONL file is malformed', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue('this is not json\n{ "invalid": "json" }');

    await expect(importer.import(tempFile)).rejects.toThrow();
  });

  it('should throw an error when metadata is missing', async () => {
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: 'pre-1',
        postFixHash: 'post-1',
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        // metadata missing
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await expect(importer.import(tempFile)).rejects.toThrow();
  });

  it('should throw an error when metadata.candidateId is missing', async () => {
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: 'pre-1',
        postFixHash: 'post-1',
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { createdAt: new Date().toISOString() }, // candidateId missing
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await expect(importer.import(tempFile)).rejects.toThrow();
  });

  it('should throw an error when metadata.createdAt is missing', async () => {
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: 'pre-1',
        postFixHash: 'post-1',
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: 'uuid-1' }, // createdAt missing
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await expect(importer.import(tempFile)).rejects.toThrow();
  });

  it('should handle missing postFixHash gracefully', async () => {
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: 'pre-1',
        // postFixHash missing
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: 'uuid-1', createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await expect(importer.import(tempFile)).rejects.toThrow();
  });

  it('should preserve the exact candidateId format from the JSONL file', async () => {
    const id = generateValidUuid();
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    await importer.import(tempFile);

    const upsertedCandidate = mockRepo.upsert.mock.calls[0][0] as Candidate;
    expect(upsertedCandidate.id).toBe(id);
  });
});
