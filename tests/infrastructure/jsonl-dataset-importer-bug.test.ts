
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { ICandidateRepository, Candidate } from '../../src/core/contracts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

vi.mock('node:fs/promises');

describe('JsonlDatasetImporter Bug', () => {
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

    importer = new JsonlDatasetImporter(mockRepo);
    tempFile = path.join(os.tmpdir(), 'test-bug-import.jsonl');
  });

  it('should correctly import JSONL files containing escaped newlines in values', async () => {
    const id = '00000000-0000-0000-0000-000000000000';
    // Use \\n to represent an escaped newline in the JSON value
    const mockData = [
      {
        repository: { url: 'https://github.com/user/repo', name: 'repo' },
        preFixHash: 'a'.repeat(40),
        postFixHash: 'b'.repeat(40),
        curation: { score: 0.9, reasoning: 'Good\\nReasoning', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      },
    ];

    vi.spyOn(fs, 'readFile').mockResolvedValue(
      mockData.map(d => JSON.stringify(d)).join('\n')
    );
    vi.mocked(mockRepo.exists).mockReturnValue(false);

    // This should succeed, but will fail if .replace(/\\n/g, '\n') is used
    await expect(importer.import(tempFile)).resolves.toBe(1);
  });
});
