import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JsonlDatasetExporter } from '../../src/infrastructure/jsonl-dataset-exporter';
import { JsonlDatasetImporter } from '../../src/infrastructure/jsonl-dataset-importer';
import { CandidateRepository } from '../../src/core/repositories/candidate-repository';
import { reinitDatabase } from '../../src/infrastructure/persistence/database';
import { generateValidUuid, generateValidHash } from '../helpers/dataset';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Dataset JSONL Data Exchange', () => {
  let exporter: JsonlDatasetExporter;
  let importer: JsonlDatasetImporter;
  let repo: CandidateRepository;
  let tempFile: string;
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(os.tmpdir(), `integration-data-exchange-db-${Date.now()}-${Math.random()}.db`);
    await reinitDatabase(tempDbPath);
    
    repo = new CandidateRepository();
    exporter = new JsonlDatasetExporter(repo);
    importer = new JsonlDatasetImporter(repo);
    tempFile = path.join(os.tmpdir(), `integration-data-exchange-${Date.now()}.jsonl`);
  });

  afterEach(async () => {
    try { await fs.unlink(tempFile); } catch {}
    try { await fs.unlink(tempDbPath); } catch {}
  });

  describe('Export Logic', () => {
    it('should export curated candidates with actual repository and curation data', async () => {
      const testCandidate = {
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'Fix critical bug',
        files: ['src/parser.ts'],
        status: 'curated' as const,
        created_at: new Date(),
        curation: { score: 0.95, reasoning: 'Good fix', isApproved: true },
        repositoryUrl: 'https://github.com/actual/repo',
        repositoryName: 'actual-repo',
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
      };

      repo.save(testCandidate);
      await exporter.export(tempFile);

      const content = await fs.readFile(tempFile, 'utf-8');
      const parsed = JSON.parse(content.split('\n').filter(l => l.trim())[0]);

      expect(parsed.repository.url).toBe('https://github.com/actual/repo');
      expect(parsed.curation.score).toBe(0.95);
    });

    it('should filter by curation status (approved and curated)', async () => {
      const curatedApproved = {
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'app',
        files: [],
        status: 'curated' as const,
        created_at: new Date(),
        curation: { score: 0.9, reasoning: 'OK', isApproved: true },
        repositoryUrl: 'https://github.com/u/r1',
        repositoryName: 'r1',
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
      };
      const curatedRejected = {
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'rej',
        files: [],
        status: 'curated' as const,
        created_at: new Date(),
        curation: { score: 0.1, reasoning: 'NO', isApproved: false },
        repositoryUrl: 'https://github.com/u/r2',
        repositoryName: 'r2',
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
      };
      const pending = {
        id: generateValidUuid(),
        hash: generateValidHash(),
        message: 'pen',
        files: [],
        status: 'pending' as const,
        created_at: new Date(),
      };

      repo.save(curatedApproved);
      repo.save(curatedRejected);
      repo.save(pending);

      await exporter.export(tempFile);

      const content = await fs.readFile(tempFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]).metadata.candidateId).toBe(curatedApproved.id);
    });
  });

  describe('Import Logic', () => {
    it('should correctly import valid candidates from JSONL', async () => {
      const id1 = generateValidUuid();
      const mockData = [
        {
          repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
          preFixHash: generateValidHash(),
          postFixHash: generateValidHash(),
          curation: { score: 0.9, reasoning: 'Good', isApproved: true },
          status: 'validated',
          metadata: { candidateId: id1, createdAt: new Date().toISOString() },
        },
      ];

      await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));
      
      await importer.import(tempFile);
      
      const all = repo.getAll();
      expect(all.length).toBeGreaterThan(0);
      expect(all.some(c => c.id === id1)).toBe(true);
    });

    it('should handle escaped newlines in values', async () => {
      const id = generateValidUuid();
      const mockData = [{
        repository: { url: 'https://github.com/user/repo', name: 'repo' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good\\nReasoning', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      }];
      await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));
      await expect(importer.import(tempFile)).resolves.not.toThrow();
    });

    it('should handle escaped newlines in values', async () => {
      const id = generateValidUuid();
      const mockData = [{
        repository: { url: 'https://github.com/user/repo', name: 'repo' },
        preFixHash: generateValidHash(),
        postFixHash: generateValidHash(),
        curation: { score: 0.9, reasoning: 'Good\\nReasoning', isApproved: true },
        status: 'validated',
        metadata: { candidateId: id, createdAt: new Date().toISOString() },
      }];
      await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));
      await expect(importer.import(tempFile)).resolves.not.toThrow();
    });

    it('should throw when JSONL is malformed', async () => {
      await fs.writeFile(tempFile, 'this is not json');
      await expect(importer.import(tempFile)).rejects.toThrow();
    });

    it('should throw when metadata is missing', async () => {
      const mockData = [{
        repository: { url: 'https://github.com/user/repo1', name: 'repo1' },
        status: 'validated',
        // metadata missing
      }];
      await fs.writeFile(tempFile, mockData.map(d => JSON.stringify(d)).join('\n'));
      await expect(importer.import(tempFile)).rejects.toThrow();
    });
  });
});
